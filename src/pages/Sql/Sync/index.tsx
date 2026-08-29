/**
 * es-adb 同步监控页
 * 路由 path: /sql/sync（后台菜单配置 sql/sync）
 * 切换项目时通过 key 强制重挂载工作区，清空旧数据并重建 SSE
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  compareSqlSync,
  getSqlSyncHealth,
  isSyncOk,
  triggerSqlSyncBackfill,
} from '@/services/sql/sync';
import { toast } from '@/components/AppNotification';
import { confirm } from '@/components/ConfirmModal';
import { useSyncProjects } from './hooks/useSyncProjects';
import { useSyncMonitor, type ConnState } from './hooks/useSyncMonitor';
import HeaderBar from './components/HeaderBar';
import KpiBar from './components/KpiBar';
import IncrChart, { IncrTable } from './components/IncrChart';
import { BackfillProgressCard } from './components/BackfillCard';
import CompareCard from './components/CompareCard';
import RuntimeCard from './components/RuntimeCard';
import EventLog from './components/EventLog';
import BackfillModal from './components/BackfillModal';
import { isRangeWithinOneMonth, parseSyncDateTime } from './utils/backfillGuard';
import { useAuthStore } from '@/stores/authStore';
import './style.css';

interface SyncWorkbenchProps {
  project: string;
  onConnStateChange: (state: ConnState) => void;
  onReconnectChange: (fn: () => void) => void;
}

/** 随 project 变化整页重挂载：SSE / KPI / 表单 / 日志全部重新初始化 */
function SyncWorkbench({ project, onConnStateChange, onReconnectChange }: SyncWorkbenchProps) {
  const {
    connState,
    incremental,
    pipeline,
    backfillProgress,
    runtime,
    logs,
    appendLog,
    reconnect,
  } = useSyncMonitor(project);

  const [bfLoading, setBfLoading] = useState(false);

  const [cmpStart, setCmpStart] = useState('');
  const [cmpEnd, setCmpEnd] = useState('');
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpEs, setCmpEs] = useState('-');
  const [cmpAdb, setCmpAdb] = useState('-');
  const [cmpDiff, setCmpDiff] = useState('-');
  const [cmpDiffCls, setCmpDiffCls] = useState('');
  const [cmpRange, setCmpRange] = useState('');
  const [cmpActualRange, setCmpActualRange] = useState<{ start: string; end: string } | null>(null);
  const [cmpHasDiff, setCmpHasDiff] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const compareReadyRef = useRef(false);
  const canWrite = useAuthStore((s) => s.hasPermission('sql:sync:w'));

  useEffect(() => {
    onConnStateChange(connState);
  }, [connState, onConnStateChange]);

  useEffect(() => {
    onReconnectChange(reconnect);
    return () => onReconnectChange(() => {});
  }, [reconnect, onReconnectChange]);

  useEffect(() => {
    getSqlSyncHealth(project).catch(() => {
      /* 健康检查失败不阻断 SSE */
    });
  }, [project]);

  const doCompare = useCallback(
    async (silent?: boolean) => {
      if (!project) return;
      const start = cmpStart.trim();
      const end = cmpEnd.trim();

      // 手动填写范围时：起止都要有，且不超过一个月；都空则走默认整点小时
      if (start || end) {
        if (!start || !end) {
          if (!silent) toast.warning('请同时填写开始与结束时间，或不填使用默认整点小时');
          return;
        }
        const startAt = parseSyncDateTime(start);
        const endAt = parseSyncDateTime(end);
        if (!startAt || !endAt) {
          if (!silent) toast.warning('时间格式无效，请使用 YYYY-MM-DD HH:mm:ss');
          return;
        }
        if (endAt.getTime() < startAt.getTime()) {
          if (!silent) toast.warning('结束时间不能早于开始时间');
          return;
        }
        if (!isRangeWithinOneMonth(startAt, endAt)) {
          if (!silent) toast.warning('对比范围不能超过一个月');
          return;
        }
      }

      setCmpLoading(true);
      const label =
        !start && !end ? '上一个整点小时（默认）' : `${start} ~ ${end}`;
      if (!silent) appendLog(`[对比] 查询 ${label}`);
      try {
        const body: { start?: string; end?: string } = {};
        if (start) body.start = start;
        if (end) body.end = end;
        const resp = await compareSqlSync(project, body);
        if (!isSyncOk(resp.code)) {
          if (!silent) toast.error(`对比失败: ${resp.message}`);
          appendLog(`[对比] 失败: ${resp.message}`, true);
          return;
        }
        const d = resp.data;
        if (!d) return;
        setCmpEs(String(d.es?.count ?? '-'));
        setCmpAdb(String(d.mysql?.count ?? '-'));
        const diff = d.diff ?? 0;
        setCmpDiff(`${diff > 0 ? '+' : ''}${diff}`);
        setCmpDiffCls(diff === 0 ? 'diff-zero' : 'diff-pos');
        setCmpHasDiff(diff !== 0);
        const rangeStart = d.range?.start || '';
        const rangeEnd = d.range?.end || '';
        setCmpActualRange(rangeStart ? { start: rangeStart, end: rangeEnd } : null);
        const defHint = !start && !end ? '（默认上一个整点小时）' : '';
        setCmpRange(
          `实际比对范围${defHint}：[${rangeStart} ~ ${rangeEnd}) · ES ${d.es?.field} · ADB ${d.mysql?.field} · ${
            d.match ? '一致 ✓' : '不一致 ✗'
          }`,
        );
        appendLog(`[对比] ES=${d.es?.count} ADB=${d.mysql?.count} diff=${diff}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!silent) toast.error(`请求失败: ${msg}`);
        appendLog('[对比] 请求失败', true);
      } finally {
        setCmpLoading(false);
      }
    },
    [project, cmpStart, cmpEnd, appendLog],
  );

  useEffect(() => {
    if (!pipeline || compareReadyRef.current || !project) return;
    compareReadyRef.current = true;
    doCompare(true);
  }, [pipeline, project, doCompare]);

  const runBackfill = useCallback(
    async (startRaw: string, endRaw: string) => {
      if (!project) return;
      if (pipeline?.backfillActive || bfLoading) {
        toast.warning('补全进行中，请等待完成后再试');
        return;
      }
      const start = startRaw.trim();
      const end = endRaw.trim();
      if (!start) {
        toast.warning('缺少开始时间');
        return;
      }
      if (!end) {
        toast.warning('缺少结束时间（单次最多一个月）');
        return;
      }
      const startAt = parseSyncDateTime(start);
      const endAt = parseSyncDateTime(end);
      if (!startAt || !endAt) {
        toast.warning('时间格式无效');
        return;
      }
      if (endAt.getTime() < startAt.getTime()) {
        toast.warning('结束时间不能早于开始时间');
        return;
      }
      if (!isRangeWithinOneMonth(startAt, endAt)) {
        toast.warning('单次补全范围不能超过一个月');
        return;
      }
      setBfLoading(true);
      appendLog(`[补全] 开始 ${start} ~ ${end}`);
      try {
        const resp = await triggerSqlSyncBackfill(project, {
          start,
          end,
        });
        if (!isSyncOk(resp.code)) {
          toast.error(`补全失败: ${resp.message}`);
          appendLog(`[补全] 失败: ${resp.message}`, true);
          return;
        }
        const s = resp.data?.summary;
        toast.success(
          `补全完成 · 窗口 ${s?.totalWindows ?? '-'} · hits ${s?.totalHits ?? '-'} · 写入 ${s?.totalWritten ?? '-'}`,
        );
        appendLog(`[补全] 完成 hits=${s?.totalHits} written=${s?.totalWritten}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`补全请求失败: ${msg}`);
        appendLog('[补全] 请求失败', true);
      } finally {
        setBfLoading(false);
      }
    },
    [project, appendLog, pipeline?.backfillActive, bfLoading],
  );

  const fillBackfillFromCompare = useCallback(async () => {
    if (!cmpHasDiff || !cmpActualRange?.start) return;
    if (!canWrite) {
      toast.warning('无写权限（sql:sync:w）');
      return;
    }
    if (pipeline?.backfillActive || bfLoading) {
      toast.warning('补全进行中，请等待完成后再试');
      return;
    }
    const start = cmpActualRange.start;
    const end = cmpActualRange.end || '';
    if (!end) {
      toast.warning('比对范围缺少结束时间，无法补全');
      return;
    }
    const startAt = parseSyncDateTime(start);
    const endAt = parseSyncDateTime(end);
    if (!startAt || !endAt || !isRangeWithinOneMonth(startAt, endAt)) {
      toast.warning('比对范围超过一个月，请缩小时间范围后再对比补全');
      return;
    }
    const rangeLabel = `[${start} ~ ${end})`;
    const ok = await confirm({
      title: '确认补全',
      content: `检测到数据差异 ${cmpDiff}。是否对范围 ${rangeLabel} 发起补全同步？`,
      okText: '开始补全',
      cancelText: '取消',
      type: 'warning',
    });
    if (!ok) return;
    appendLog(`[对比] 差异补全 ${rangeLabel}`);
    runBackfill(start, end);
  }, [
    cmpHasDiff,
    cmpActualRange,
    cmpDiff,
    runBackfill,
    appendLog,
    pipeline?.backfillActive,
    bfLoading,
    canWrite,
  ]);

  const resetCompare = useCallback(() => {
    setCmpStart('');
    setCmpEnd('');
    setCmpEs('-');
    setCmpAdb('-');
    setCmpDiff('-');
    setCmpDiffCls('');
    setCmpRange('');
    setCmpActualRange(null);
    setCmpHasDiff(false);
  }, []);

  const disabled = !project;

  return (
    <>
      <KpiBar pipeline={pipeline} backfillProgress={backfillProgress} />

      <div className="work">
        <div className="col-main">
          <IncrChart data={incremental} />
          <IncrTable data={incremental} />
        </div>

        <div className="col-side">
          <CompareCard
            project={project}
            cmpStart={cmpStart}
            cmpEnd={cmpEnd}
            onCmpStartChange={setCmpStart}
            onCmpEndChange={setCmpEnd}
            onCompare={() => doCompare(false)}
            onReset={resetCompare}
            loading={cmpLoading}
            disabled={disabled}
            esCount={cmpEs}
            adbCount={cmpAdb}
            diff={cmpDiff}
            diffCls={cmpDiffCls}
            rangeText={cmpRange}
            actualRange={cmpActualRange}
            hasDiff={cmpHasDiff}
            canWrite={canWrite}
            backfillBusy={!!pipeline?.backfillActive || bfLoading}
            onFullBackfill={fillBackfillFromCompare}
            onLog={appendLog}
          />
          <BackfillProgressCard
            progress={backfillProgress}
            onOpenDetail={() => {
              if (project) setModalOpen(true);
              else toast.warning('请先选择项目');
            }}
          />
          <RuntimeCard runtime={runtime} />
          <EventLog logs={logs} />
        </div>
      </div>

      <BackfillModal
        open={modalOpen}
        project={project}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

const SqlSync = () => {
  const {
    projectList,
    projectLoading,
    currentProject,
    setCurrentProject,
    fetchProjects,
  } = useSyncProjects();

  const [connState, setConnState] = useState<ConnState>('idle');
  const reconnectRef = useRef<() => void>(() => {});

  const handleRegisterReconnect = useCallback((fn: () => void) => {
    reconnectRef.current = fn;
  }, []);

  const handleManualReconnect = useCallback(() => {
    if (!currentProject) return;
    reconnectRef.current();
  }, [currentProject]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleProjectChange = useCallback(
    (next: string) => {
      if (!next || next === currentProject) return;
      setConnState('connecting');
      setCurrentProject(next);
    },
    [currentProject, setCurrentProject],
  );

  return (
    <div className="sql-sync">
      <HeaderBar
        projectList={projectList}
        projectLoading={projectLoading}
        currentProject={currentProject}
        onProjectChange={handleProjectChange}
        connState={connState}
        onReconnect={handleManualReconnect}
      />

      {currentProject ? (
        <SyncWorkbench
          key={currentProject}
          project={currentProject}
          onConnStateChange={setConnState}
          onReconnectChange={handleRegisterReconnect}
        />
      ) : null}
    </div>
  );
};

export default SqlSync;
