
<!-- 鼠标点击涟漪效果参考网址https://codepen.io/sabitha_kuppusamy/pen/YbMxVX -->

<!-- 鼠标点击水波涟漪效果 -->
<template>
  <canvas
      ref="canvas"
      style="position: fixed; left: 0; top: 0; pointer-events: none; z-index: 999999"
  ></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
// 背景网格或波纹颜色和透明度
const rgba = 'rgba(255, 255, 255, 0.01)'

const canvas = ref(null);
let ctx = null;
let animationId = null;

// 水面网格参数
let cols, rows;
let spacing = 8; // 网格间距
let damping = 0.96; // 阻尼系数

// 当前波和上一帧波
let currentWave = [];
let previousWave = [];

// 设置画布
function initCanvas() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.value.width = width;
  canvas.value.height = height;

  ctx = canvas.value.getContext('2d');

  cols = Math.floor(width / spacing) + 1;
  rows = Math.floor(height / spacing) + 1;

  // 初始化波数组
  currentWave = new Array(cols * rows).fill(0);
  previousWave = new Array(cols * rows).fill(0);
}

// 在指定位置创建波源
function createRipple(x, y, strength = 500) {
  const col = Math.floor(x / spacing);
  const row = Math.floor(y / spacing);

  if (col > 0 && col < cols - 1 && row > 0 && row < rows - 1) {
    const index = col + row * cols;
    currentWave[index] = strength;

    // 周围点也受影响
    currentWave[index - 1] = strength * 0.5;
    currentWave[index + 1] = strength * 0.5;
    currentWave[index - cols] = strength * 0.5;
    currentWave[index + cols] = strength * 0.5;
  }
}

// 波传播算法
function propagateWaves() {
  const temp = previousWave;
  previousWave = currentWave;
  currentWave = temp;

  for (let i = 1; i < cols - 1; i++) {
    for (let j = 1; j < rows - 1; j++) {
      const index = i + j * cols;

      // 波传播公式（基于相邻点的平均值）
      currentWave[index] = (
          previousWave[index - 1] +
          previousWave[index + 1] +
          previousWave[index - cols] +
          previousWave[index + cols]
      ) / 2 - currentWave[index];

      // 应用阻尼
      currentWave[index] *= damping;
    }
  }
}

// 渲染水波效果
function render() {
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);

  // 绘制波纹（使用半透明线条模拟折射效果）
  ctx.lineWidth = 1;

  // 绘制水平波纹线
  for (let j = 0; j < rows - 1; j++) {
    ctx.beginPath();
    for (let i = 0; i < cols; i++) {
      const index = i + j * cols;
      const x = i * spacing;
      const y = j * spacing + currentWave[index] * 0.3;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = rgba;
    ctx.stroke();
  }

  // 绘制垂直波纹线
  for (let i = 0; i < cols - 1; i++) {
    ctx.beginPath();
    for (let j = 0; j < rows; j++) {
      const index = i + j * cols;
      const x = i * spacing + currentWave[index] * 0.3;
      const y = j * spacing;

      if (j === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = rgba;
    ctx.stroke();
  }
}

// 动画循环
function animate() {
  propagateWaves();
  render();
  animationId = requestAnimationFrame(animate);
}

// 处理鼠标点击
function handleClick(e) {
  const x = e.clientX;
  const y = e.clientY;
  createRipple(x, y, 800);
}

// 处理鼠标移动（产生连续小波纹）
let lastMouseX = 0;
let lastMouseY = 0;

function handleMouseMove(e) {
  const x = e.clientX;
  const y = e.clientY;

  // 计算鼠标移动速度
  const dx = x - lastMouseX;
  const dy = y - lastMouseY;
  const speed = Math.sqrt(dx * dx + dy * dy);

  // 移动足够快时才产生波纹
  if (speed > 5) {
    createRipple(x, y, 200);
  }

  lastMouseX = x;
  lastMouseY = y;
}

onMounted(() => {
  initCanvas();
  animate();

  window.addEventListener('mousedown', handleClick);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('resize', initCanvas);
});

onUnmounted(() => {
  window.removeEventListener('mousedown', handleClick);
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('resize', initCanvas);
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});
</script>







