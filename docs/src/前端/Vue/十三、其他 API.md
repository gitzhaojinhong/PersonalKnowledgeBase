<ClientOnly>

## 13.1 shallowRef 与 shallowReactive

### 13.1.1 shallowRef

`shallowRef()` 只跟踪引用值的变化，不关心值内部的属性变化。

```vue
<template>
    <div class="person">
        <h3>Person组件</h3>
        <h4>计数器：{{ count }}</h4>
        <h4>姓名：{{ person.name }}</h4>
        <h4>年龄：{{ person.age }}</h4>
        <button @click="add">计数器加1</button>
        <button @click="changeName">修改姓名</button>
        <button @click="changeAge">修改年龄</button>
        <button @click="changePerson">修改整个人</button>
    </div>
</template>
<script lang='ts' setup name="Person">
    import { shallowRef } from 'vue';

    let count = shallowRef(0);
    let person = shallowRef({
        name: 'jackson',
        age: 20
    });

    function add() {
        count.value++;  // 响应式
    }
    function changeName() {
        person.value.name = 'lucy';  // 不是响应式
    }
    function changeAge() {
        person.value.age++;  // 不是响应式
    }
    function changePerson() {
        person.value = { name: 'king', age: 30 };  // 响应式
    }
</script>
```

### 13.1.2 shallowReactive

`shallowReactive()` 对象的顶层属性是响应式的，但嵌套的对象属性不是。

```vue
<script lang='ts' setup name="Person">
    import { shallowReactive } from 'vue';

    let person = shallowReactive({
        name: 'jackson',
        age: 20,
        address: {
            city: 'BeiJing'
        }
    });

    function changeName() {
        person.name = 'lucy';  // 响应式
    }
    function changeCity() {
        person.address.city = 'TianJin';  // 不是响应式
    }
</script>
```

## 13.2 readonly 与 shallowReadonly

### 13.2.1 readonly（深只读）

创建一个响应式对象的深只读副本，不允许修改。

```vue
<script lang='ts' setup>
    import { reactive, readonly } from 'vue';

    let person = reactive({
        name: 'jackson',
        age: 20,
        address: {
            city: 'BeiJing'
        }
    });

    let person1 = readonly(person);

    // 以下修改都会报错
    person1.name = 'lucy';  // 报错
    person1.age++;  // 报错
    person1.address.city = 'TianJin';  // 报错
</script>
```

### 13.2.2 shallowReadonly（浅只读）

对象的顶层属性是只读的，深层次的属性不是只读的。

```vue
<script lang='ts' setup>
    import { reactive, shallowReadonly } from 'vue';

    let person = reactive({
        name: 'jackson',
        age: 20,
        address: {
            city: 'BeiJing'
        }
    });

    let person2 = shallowReadonly(person);

    person2.name = 'lucy';  // 报错
    person2.address.city = 'TianJin';  // 正常
</script>
```

## 13.3 toRaw 与 markRaw

### 13.3.1 toRaw

`toRaw` 可以获取响应式对象对应的原始对象。使用场景：在需要将响应式对象传递给非 Vue 的库或外部系统时使用。

```vue
<script lang='ts' setup>
    import { reactive, toRaw } from 'vue';

    let person = reactive({
        name: 'jackson',
        age: 30
    });

    let rawPerson = toRaw(person);
    // rawPerson 是一个普通对象，不是响应式的
</script>
```

### 13.3.2 markRaw

`markRaw` 标记的对象永远不会变成响应式对象。使用场景：防止第三方库的某个对象变为响应式对象。

```vue
<script lang='ts' setup>
    import { markRaw, reactive } from 'vue';

    let person = markRaw({name: 'jackson', age: 30});
    let person2 = reactive(person);  // person2 仍然是非响应式对象
</script>
```

## 13.4 customRef

`customRef` 可以自定义 ref 的响应式效果，详见第十一章 Hooks 部分。
</ClientOnly>