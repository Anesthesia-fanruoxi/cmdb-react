/**
 * 登录页弹球动画
 * 32个5px小球匀速弹跳，碰撞加速，持续碰撞会刷新加速时间
 * 长按鼠标吸附所有球，松开后加速散开
 */

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  speedBoostEnd: number; // 加速结束时间
}

const BALL_RADIUS = 5;
const BALL_COUNT = 32;
const INITIAL_SPEED = 1.2;
const BOOST_SPEED = 1.8;
const BOOST_DURATION = 2000; // 2秒
const SCATTER_SPEED = 3.0; // 散开速度
const ATTRACT_FORCE = 0.3; // 吸附力（2倍）
const MOUSE_IDLE_TIMEOUT = 2000; // 鼠标静止2秒后停止吸引

/** 彩虹色系 */
const COLORS = [
  '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c',
  '#4dabf7', '#9775fa', '#f783ac', '#38d9a9',
];

/** 在容器内启动弹球动画，返回清理函数 */
export function startBouncingBalls(container: HTMLElement): () => void {
  const balls: Ball[] = [];
  let animationId = 0;
  let mousePos: { x: number; y: number } | null = null;
  let lastMouseMove = 0;

  const loginRight = container.querySelector('.login-right');
  const getRightBoundary = () => {
    if (!loginRight) return container.getBoundingClientRect().width;
    return loginRight.getBoundingClientRect().left - container.getBoundingClientRect().left;
  };

  // 初始化：创建32个5px小球
  for (let i = 0; i < BALL_COUNT; i++) {
    const color = COLORS[i % COLORS.length];
    const angle = Math.random() * Math.PI * 2;
    balls.push({
      x: Math.random() * (getRightBoundary() - BALL_RADIUS * 2) + BALL_RADIUS,
      y: Math.random() * (container.getBoundingClientRect().height - BALL_RADIUS * 2) + BALL_RADIUS,
      vx: Math.cos(angle) * INITIAL_SPEED,
      vy: Math.sin(angle) * INITIAL_SPEED,
      radius: BALL_RADIUS,
      color,
      speedBoostEnd: 0,
    });
  }

  // 鼠标事件监听
  const handleMouseMove = (e: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    lastMouseMove = Date.now();
  };

  const handleMouseLeave = () => {
    mousePos = null;
  };

  const handleMouseUp = () => {
    if (mousePos) {
      // 松开鼠标，所有球加速散开
      const now = Date.now();
      for (const ball of balls) {
        const dx = ball.x - mousePos.x;
        const dy = ball.y - mousePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          ball.vx = (dx / dist) * SCATTER_SPEED;
          ball.vy = (dy / dist) * SCATTER_SPEED;
          ball.speedBoostEnd = now + BOOST_DURATION;
        }
      }
    }
  };

  container.addEventListener('mousemove', handleMouseMove);
  container.addEventListener('mouseleave', handleMouseLeave);
  container.addEventListener('mouseup', handleMouseUp);

  const step = () => {
    const bounds = container.getBoundingClientRect();
    const rightBoundary = getRightBoundary();
    const maxX = rightBoundary;
    const maxY = bounds.height;
    const now = Date.now();

    for (const ball of balls) {
      // 鼠标跟随效果：形成链条（鼠标移动时才会吸引，且不在登录表单区域）
      const isMouseMoving = (now - lastMouseMove) < MOUSE_IDLE_TIMEOUT;
      const isInLoginArea = mousePos && mousePos.x > getRightBoundary();
      if (mousePos && isMouseMoving && !isInLoginArea) {
        const ballIndex = balls.indexOf(ball);
        let targetX: number;
        let targetY: number;
        
        if (ballIndex === 0) {
          // 第一个球直接跟随鼠标
          targetX = mousePos.x;
          targetY = mousePos.y;
        } else {
          // 后续球跟随前一个球，保持间距
          const prevBall = balls[ballIndex - 1];
          const dx = prevBall.x - ball.x;
          const dy = prevBall.y - ball.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const spacing = BALL_RADIUS * 3; // 球之间的间距
          
          if (dist > spacing) {
            targetX = prevBall.x - (dx / dist) * spacing;
            targetY = prevBall.y - (dy / dist) * spacing;
          } else {
            targetX = ball.x;
            targetY = ball.y;
          }
        }
        
        const dx = targetX - ball.x;
        const dy = targetY - ball.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          ball.vx += (dx / dist) * ATTRACT_FORCE;
          ball.vy += (dy / dist) * ATTRACT_FORCE;
          // 限制跟随时的最大速度
          const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
          if (speed > BOOST_SPEED) {
            ball.vx = (ball.vx / speed) * BOOST_SPEED;
            ball.vy = (ball.vy / speed) * BOOST_SPEED;
          }
        }
      } else {
        // 正常速度控制（加速状态）
        const currentSpeed = now < ball.speedBoostEnd ? BOOST_SPEED : INITIAL_SPEED;
        const speedRatio = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speedRatio > 0) {
          ball.vx = (ball.vx / speedRatio) * currentSpeed;
          ball.vy = (ball.vy / speedRatio) * currentSpeed;
        }
      }

      // 更新位置
      ball.x += ball.vx;
      ball.y += ball.vy;

      // 边界检测
      if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= maxX) {
        ball.vx = -ball.vx;
        ball.x = Math.max(ball.radius, Math.min(ball.x, maxX - ball.radius));
        // 碰撞刷新加速时间
        ball.speedBoostEnd = now + BOOST_DURATION;
      }
      if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= maxY) {
        ball.vy = -ball.vy;
        ball.y = Math.max(ball.radius, Math.min(ball.y, maxY - ball.radius));
        // 碰撞刷新加速时间
        ball.speedBoostEnd = now + BOOST_DURATION;
      }
    }

    // 渲染
    renderBalls(container, balls);
    animationId = requestAnimationFrame(step);
  };

  animationId = requestAnimationFrame(step);

  return () => {
    cancelAnimationFrame(animationId);
    container.removeEventListener('mousemove', handleMouseMove);
    container.removeEventListener('mouseleave', handleMouseLeave);
    container.removeEventListener('mouseup', handleMouseUp);
    const ballElements = container.querySelectorAll('.bouncing-ball');
    ballElements.forEach(el => el.remove());
  };
}

/** 渲染所有球 */
function renderBalls(container: HTMLElement, balls: Ball[]): void {
  // 移除多余的球元素
  const existingElements = container.querySelectorAll('.bouncing-ball');
  for (let i = balls.length; i < existingElements.length; i++) {
    existingElements[i].remove();
  }

  // 更新或创建球元素
  balls.forEach((ball, index) => {
    let element = existingElements[index] as HTMLElement | undefined;

    if (!element) {
      element = document.createElement('div');
      element.className = 'bouncing-ball';
      container.appendChild(element);
    }

    const diameter = ball.radius * 2;
    element.style.width = `${diameter}px`;
    element.style.height = `${diameter}px`;
    element.style.left = `${ball.x - ball.radius}px`;
    element.style.top = `${ball.y - ball.radius}px`;
    element.style.background = `radial-gradient(circle at 30% 30%, ${ball.color}ff, ${ball.color}80 50%, ${ball.color}40)`;
    element.style.boxShadow = `0 0 ${ball.radius}px ${ball.color}80, 0 0 ${ball.radius * 2}px ${ball.color}40`;
  });
}
