/**
 * 启动流程 Hook
 * 管理启动动画的场景切换和步骤执行
 */

import { useState, useCallback } from 'react';
import type { FlowType } from '../components/StartupScreen';
import { FLOW_STEPS } from '../components/StartupScreen';

interface UseStartupFlowReturn {
  flowType: FlowType;
  currentStep: number;
  isRunning: boolean;
  startFlow: (type: FlowType, tasks: Array<() => Promise<void>>) => Promise<void>;
  resetFlow: () => void;
}

export function useStartupFlow(): UseStartupFlowReturn {
  const [flowType, setFlowType] = useState<FlowType>('none');
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  /**
   * 启动一个动画流程
   * @param type 流程类型
   * @param tasks 每个步骤对应的异步任务
   */
  const startFlow = useCallback(async (type: FlowType, tasks: Array<() => Promise<void>>) => {
    const steps = FLOW_STEPS[type];
    if (steps.length === 0) return;

    setFlowType(type);
    setCurrentStep(0);
    setIsRunning(true);

    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      
      // 执行对应的任务
      if (tasks[i]) {
        try {
          await tasks[i]();
        } catch (error) {
          console.error(`[StartupFlow] 步骤 ${i} 执行失败:`, error);
        }
      }
      
      // 步骤间延迟，让用户看到进度
      await new Promise(r => setTimeout(r, 300));
    }

    setIsRunning(false);
    setFlowType('none');
  }, []);

  /**
   * 重置流程状态
   */
  const resetFlow = useCallback(() => {
    setFlowType('none');
    setCurrentStep(0);
    setIsRunning(false);
  }, []);

  return {
    flowType,
    currentStep,
    isRunning,
    startFlow,
    resetFlow,
  };
}

export default useStartupFlow;
