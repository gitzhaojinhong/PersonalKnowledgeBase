
> Hooks 是 Vue 3 组合式 API 的一种应用模式，用于封装和复用有状态的逻辑。

## 12.1 Hooks 的概念

Hooks（组合式函数）是 Vue 3 中用于封装和复用有状态逻辑的函数。通过 Hooks，你可以将组件中的响应式状态和相关逻辑抽取到一个可复用的函数中。

**与 Pinia 的区别：**
- **Hooks**：解决"怎么写代码更优雅"，是代码的组织方式
- **Pinia**：解决"数据放哪里大家都能用"，是状态的存储方案

## 12.2 customRef 实现延迟响应式

`customRef` 可以完成自定义 ref 的效果，实现带有延迟性的响应式对象。

### 12.2.1 基本用法

```vue
<template>
    <div class="person">
        <h3>Person组件</h3>
        <h4>消息: {{ msg }}</h4>
        <input type="text" v-model="msg">
    </div>
</template>
<script lang='ts' setup name="Person">
    import { customRef } from 'vue';

    let timer: number;
    let initValue = 'hello';

    let msg = customRef((track, trigger) => {
        return {
            get() {
                track();  // 告诉 Vue 要持续跟踪该数据
                return initValue;
            },
            set(value) {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    initValue = value;
                    trigger();  // 通知 Vue 数据被修改了
                }, 2000);
            }
        }
    });
</script>
```

### 12.2.2 封装为 Hook

新建 `hooks/useMsgRef.ts`：

```typescript
import { customRef } from "vue";

export default function(initValue: string, delay: number = 1000) {
    let timer: number;

    let msg = customRef((track, trigger) => {
        return {
            get() {
                track();
                return initValue;
            },
            set(value) {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    trigger();
                    initValue = value;
                }, delay);
            }
        }
    });

    return {msg};
}
```

在组件中使用 Hook：

```vue
<script lang='ts' setup name="Person">
    import { ref } from 'vue';
    import useMsgRef from '../hooks/useMsgRef';

    let msg2 = ref('hello');
    let {msg} = useMsgRef('hello', 3000);
</script>
```

## 12.3 常用的 Hooks 示例

### 12.3.1 useLocalStorage Hook

```typescript
import { ref, watch } from 'vue';

export function useLocalStorage(key: string, defaultValue: any) {
    const data = ref(defaultValue);

    // 初始化时从 localStorage 读取
    const stored = localStorage.getItem(key);
    if (stored) {
        data.value = JSON.parse(stored);
    }

    // 监听变化并保存到 localStorage
    watch(data, (newValue) => {
        localStorage.setItem(key, JSON.stringify(newValue));
    }, { deep: true });

    return data;
}
```

使用示例：

```vue
<script lang='ts' setup>
    import { useLocalStorage } from './hooks/useLocalStorage';

    const username = useLocalStorage('username', '');
</script>
```

### 12.3.2 useMousePosition Hook

```typescript
import { ref, onMounted, onUnmounted } from 'vue';

export function useMousePosition() {
    const x = ref(0);
    const y = ref(0);

    function update(e: MouseEvent) {
        x.value = e.pageX;
        y.value = e.pageY;
    }

    onMounted(() => {
        window.addEventListener('mousemove', update);
    });

    onUnmounted(() => {
        window.removeEventListener('mousemove', update);
    });

    return { x, y };
}
```

使用示例：

```vue
<script lang='ts' setup>
    import { useMousePosition } from './hooks/useMousePosition';

    const { x, y } = useMousePosition();
</script>
<template>
    <p>鼠标位置: {{ x }}, {{ y }}</p>
</template>
```
