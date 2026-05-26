/**
 * 仪表盘组件
 * 显示时钟、日期、农历、问候语等信息
 */

import { useState, useEffect, useMemo } from 'react';
import { PasswordGen, CaseConvert, JsonFormatter, CronExpr } from './tools';
import './tools/tools-shared.css';
import './dashboard.css';

type ToolName = 'password' | 'case' | 'json' | 'cron' | null;

type ClockMode = 'digital' | 'analog';
type TimeOfDay = 'dawn' | 'morning' | 'day' | 'dusk' | 'night';

// 农历数据
const lunarInfo = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252
];

const tianGan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const diZhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const lunarMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '腊'];
const lunarDays = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

// 农历计算函数
function getLunarYearDays(year: number) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (lunarInfo[year - 1900] & i) ? 1 : 0;
  }
  return sum + getLeapDays(year);
}

function getLeapMonth(year: number) {
  return lunarInfo[year - 1900] & 0xf;
}

function getLeapDays(year: number) {
  if (getLeapMonth(year)) {
    return (lunarInfo[year - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

function getLunarMonthDays(year: number, month: number) {
  return (lunarInfo[year - 1900] & (0x10000 >> month)) ? 30 : 29;
}

function getLunarDate(date: Date): string {
  const baseDate = new Date(1900, 0, 31);
  let offset = Math.floor((date.getTime() - baseDate.getTime()) / 86400000);
  
  let year = 1900;
  let daysInYear = 0;
  while (year < 2100 && offset > 0) {
    daysInYear = getLunarYearDays(year);
    offset -= daysInYear;
    year++;
  }
  if (offset < 0) {
    offset += daysInYear;
    year--;
  }
  
  let month = 1;
  const leapMonth = getLeapMonth(year);
  let isLeap = false;
  let daysInMonth = 0;
  
  while (month < 13 && offset > 0) {
    if (leapMonth > 0 && month === leapMonth + 1 && !isLeap) {
      month--;
      isLeap = true;
      daysInMonth = getLeapDays(year);
    } else {
      daysInMonth = getLunarMonthDays(year, month);
    }
    if (isLeap && month === leapMonth + 1) isLeap = false;
    offset -= daysInMonth;
    month++;
  }
  if (offset < 0) {
    offset += daysInMonth;
    month--;
  }
  
  const day = offset + 1;
  const ganIndex = (year - 4) % 10;
  const zhiIndex = (year - 4) % 12;
  
  return `${tianGan[ganIndex]}${diZhi[zhiIndex]}年 ${lunarMonths[month - 1]}月${lunarDays[day - 1]}`;
}

const Dashboard = () => {
  const [clockMode, setClockMode] = useState<ClockMode>('digital');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [hourDeg, setHourDeg] = useState(0);
  const [minuteDeg, setMinuteDeg] = useState(0);
  const [secondDeg, setSecondDeg] = useState(0);
  const [activeTool, setActiveTool] = useState<ToolName>(null);

  // 根据时间段设置背景
  const timeOfDay = useMemo((): TimeOfDay => {
    const hour = new Date().getHours();
    if (hour < 6) return 'dawn';
    if (hour < 9) return 'morning';
    if (hour < 17) return 'day';
    if (hour < 19) return 'dusk';
    return 'night';
  }, []);

  // 问候语
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return { icon: '🌙', text: '凌晨好' };
    if (hour < 9) return { icon: '🌅', text: '早上好' };
    if (hour < 12) return { icon: '🌞', text: '上午好' };
    if (hour < 14) return { icon: '☀️', text: '中午好' };
    if (hour < 17) return { icon: '⛅', text: '下午好' };
    if (hour < 19) return { icon: '🌅', text: '傍晚好' };
    return { icon: '🌙', text: '晚上好' };
  }, []);

  // 星期
  const weekDay = useMemo(() => {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return days[new Date().getDay()];
  }, []);

  // 农历
  const lunarDate = useMemo(() => getLunarDate(new Date()), []);

  // 星座
  const zodiacSign = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const signs = [
      { name: '摩羯座', end: [1, 19] }, { name: '水瓶座', end: [2, 18] },
      { name: '双鱼座', end: [3, 20] }, { name: '白羊座', end: [4, 19] },
      { name: '金牛座', end: [5, 20] }, { name: '双子座', end: [6, 21] },
      { name: '巨蟹座', end: [7, 22] }, { name: '狮子座', end: [8, 22] },
      { name: '处女座', end: [9, 22] }, { name: '天秤座', end: [10, 23] },
      { name: '天蝎座', end: [11, 22] }, { name: '射手座', end: [12, 21] },
      { name: '摩羯座', end: [12, 31] }
    ];
    for (const sign of signs) {
      if (month < sign.end[0] || (month === sign.end[0] && day <= sign.end[1])) {
        return sign.name;
      }
    }
    return '摩羯座';
  }, []);

  // 更新时间
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('zh-CN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }));
      setCurrentDate(`${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`);

      const hours = now.getHours() % 12;
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      setSecondDeg(seconds * 6);
      setMinuteDeg(minutes * 6 + seconds * 0.1);
      setHourDeg(hours * 30 + minutes * 0.5);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`dashboard ${timeOfDay}`}>
      <div className="dashboard-main">
      <div className="clock-container" onClick={() => setClockMode(m => m === 'digital' ? 'analog' : 'digital')}>
        <div className="clock-area">
          {clockMode === 'digital' ? (
            <div className="tech-frame">
              <div className="tech-border">
                <div className="time-wrapper">
                  <div className="time">{currentTime}</div>
                  <div className="time-shadow">{currentTime}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="round-clock">
              <div className="clock-face">
                {Array.from({ length: 60 }, (_, i) => (
                  <div key={`tick-${i}`} className="minute-tick" style={{ transform: `rotate(${i * 6}deg)` }}>
                    <span className={`tick-line ${i % 5 === 0 ? 'hour-tick' : ''}`} />
                  </div>
                ))}
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={`num-${i}`} className="hour-mark" style={{ transform: `rotate(${(i + 1) * 30}deg)` }}>
                    <span className="mark-number" style={{ transform: `rotate(${-(i + 1) * 30}deg)` }}>{i + 1}</span>
                  </div>
                ))}
                <div className="hand hour-hand" style={{ transform: `rotate(${hourDeg}deg)` }} />
                <div className="hand minute-hand" style={{ transform: `rotate(${minuteDeg}deg)` }} />
                <div className="hand second-hand" style={{ transform: `rotate(${secondDeg}deg)` }} />
                <div className="center-dot" />
              </div>
            </div>
          )}
        </div>
        <div className="clock-hint">点击切换</div>

        <div className="clock-info">
          <div className="date">{currentDate} {weekDay}</div>
          <div className="lunar-info">
            <span className="lunar">{lunarDate}</span>
            <span className="divider">|</span>
            <span className="zodiac">{zodiacSign}</span>
          </div>
          <div className="greeting">
            <span className="greeting-icon">{greeting.icon}</span>
            <span className="greeting-text">{greeting.text}</span>
          </div>
        </div>
        </div>

        {/* 小工具卡片 */}
        <div className="tools-section">
        <div className="tools-header">
          <span className="tools-title">🧰 小工具</span>
          <span className="tools-subtitle">即开即用，无需跳转</span>
        </div>
        <div className="tools-grid">
          <div className="tool-card" onClick={() => setActiveTool('password')}>
            <div className="tool-icon">🔑</div>
            <div className="tool-name">随机密码</div>
            <div className="tool-desc">生成高强度随机密码</div>
          </div>
          <div className="tool-card" onClick={() => setActiveTool('case')}>
            <div className="tool-icon">🐪</div>
            <div className="tool-name">驼峰转换</div>
            <div className="tool-desc">snake_case / camelCase 互转</div>
          </div>
          <div className="tool-card" onClick={() => setActiveTool('json')}>
            <div className="tool-icon">📋</div>
            <div className="tool-name">JSON格式化</div>
            <div className="tool-desc">美化 / 压缩 / 校验 JSON</div>
          </div>
          <div className="tool-card" onClick={() => setActiveTool('cron')}>
            <div className="tool-icon">⏰</div>
            <div className="tool-name">Cron表达式</div>
            <div className="tool-desc">可视化生成定时表达式</div>
          </div>
        </div>
      </div>
      </div>

      {/* 小工具弹框 */}
      <PasswordGen visible={activeTool === 'password'} onClose={() => setActiveTool(null)} />
      <CaseConvert visible={activeTool === 'case'} onClose={() => setActiveTool(null)} />
      <JsonFormatter visible={activeTool === 'json'} onClose={() => setActiveTool(null)} />
      <CronExpr visible={activeTool === 'cron'} onClose={() => setActiveTool(null)} />
    </div>
  );
};

export default Dashboard;
