

## 1. 快速上手（常用场景）

### 1.1 集合排序（最常用）

**场景**：对 `List` 集合进行自定义排序，是 Lambda 最典型的应用场景。

```java
// 传统写法：匿名内部类（繁琐）
List<Integer> list = Arrays.asList(3, 6, 1, 7, 2, 5, 4);
Collections.sort(list, new Comparator<Integer>() {
    @Override
    public int compare(Integer o1, Integer o2) {
        return o2 - o1; // 降序
    }
});

// Lambda 写法（简洁优雅）
Collections.sort(list, (o1, o2) -> o2 - o1);

// 更精简：配合 List.sort
list.sort((o1, o2) -> o2 - o1);
System.out.println("排序后：" + list);
```

**输出**：`[7, 6, 5, 4, 3, 2, 1]`

---

### 1.2 遍历集合（forEach）

```java
// 遍历 List
List<Integer> list = Arrays.asList(11, 22, 33, 44, 55);
list.forEach(element -> System.out.println(element));
// 方法引用写法（更精简）
list.forEach(System.out::println);

// 遍历 Set
Set<String> set = new HashSet<>(Arrays.asList("aa", "bb", "cc"));
set.forEach(System.out::println);

// 遍历 Map
Map<String, String> map = new HashMap<>();
map.put("张三", "成都");
map.put("李四", "重庆");
map.put("王五", "西安");
map.forEach((k, v) -> System.out.println("key：" + k + "，value：" + v));
```

### 1.3 条件删除（removeIf）

```java
List<String> list = new ArrayList<>(Arrays.asList("aa", "bb", "cc", "dd"));
// 删除等于 "bb" 的元素
list.removeIf(element -> "bb".equals(element));
System.out.println(list); // 输出：[aa, cc, dd]
```

---

## 2. Lambda 表达式语法详解

### 2.1 基本语法

Lambda 表达式本质是一个**匿名函数**，语法格式为：

```
(形参列表) -> { 方法体 }
```

- `->` 称为 **Lambda 操作符**（或箭头操作符）
- **形参列表**：对应接口抽象方法的参数列表（类型可省略）
- **方法体**：对应接口抽象方法的方法体

**示例**：将匿名内部类转化为 Lambda

```java
// 匿名内部类写法
Collections.sort(list, new Comparator<Integer>() {
    @Override
    public int compare(Integer o1, Integer o2) {
        return o2 - o1;
    }
});

// 基础 Lambda 写法（保留参数类型）
Collections.sort(list, (Integer o1, Integer o2) -> {
    return o2 - o1;
});
```

### 2.2 语法精简规则

Lambda 支持进一步精简，**但精简过度会降低可读性，建议适度使用**。

| 规则 | 说明 |
|------|------|
| **省略参数类型** | 参数类型由编译器根据上下文推断，可逐个省略，不必同时省略 |
| **单参数省略括号** | 只有一个参数时，小括号和类型可以同时省略 |
| **单行代码省略大括号** | 方法体只有一行代码时，大括号可以省略 |
| **省略 return** | 方法体只有一行 return 语句时，大括号和 return 都可以省略 |

**精简示例（完整可运行）**：

```java
public class LambdaSimplifyDemo {
    public static void main(String[] args) {
        // 规则1：省略参数类型
        MoreParameterNoReturn obj1 = (str1, str2) -> {
            System.out.println(str1 + " : " + str2);
        };
        obj1.test("hello", "world");

        // 规则2：单参数省略小括号和类型
        OneParameterHasReturn obj2 = num -> {
            return "传入的小数为：" + num;
        };
        System.out.println(obj2.test(520.0));

        // 规则3：单行代码省略大括号
        NoParameterNoReturn obj3 = () -> System.out.println("无参无返回值");
        obj3.test();

        // 规则4：省略 return（最精简写法）
        MoreParameterHasReturn obj4 = (a, b) -> "运算的结果为：" + (a + b);
        System.out.println(obj4.test(20, 30));
    }
}
```

### 2.3 目标类型推断

Lambda 表达式**本身没有类型**，编译器根据使用场景的目标类型自动推断参数和返回值的类型。

**支持目标类型推断的上下文**：

| 上下文场景 | 示例 |
|-----------|------|
| 变量声明赋值 | `Comparator<Person> cmp = (p1, p2) -> ...` |
| 方法参数传递 | `list.forEach(s -> System.out.println(s))` |
| 返回语句 | `return p -> p.getAge() > 18` |
| 数组初始化器 | `new Function[]{ p -> p.getName() }` |
| 强制类型转换 | `(Predicate<String>) s -> s.isEmpty()` |

```java
// 目标类型为 Runnable，编译器推断参数为空
Runnable r = () -> System.out.println("hi");

// 目标类型为 Consumer<String>，编译器推断参数为 String
Consumer<String> c = s -> System.out.println(s);

// 同一个 Lambda，在不同目标类型下类型不同
Function<String, Integer> f1 = s -> s.length();      // String -> Integer
Supplier<String> s1 = () -> "hello";                  // () -> String
```

### 2.4 变量捕获规则

Lambda 可以访问外层作用域的局部变量，但该变量必须是 **final 或 effectively final**。

**概念解释**：
- **final**：显式声明为 final 的变量
- **effectively final**：未被重新赋值的局部变量（Java 编译器会隐式视为 final）

```java
// 正确：age 是 effectively final
int age = 18;
Predicate<Person> pred = p -> p.getAge() > age; // OK

// 错误：age 被重新赋值，不再是 effectively final，Lambda 引用会编译报错
int age = 18;
age = 20; // 此行一旦加上，下面的 Lambda 编译报错
Predicate<Person> pred = p -> p.getAge() > age; // 编译错误！
```

> **为什么有此限制？** Lambda 在执行时可能延迟访问外层变量，如果变量在 Lambda 创建后被修改，会产生难以预测的行为。因此 Java 要求变量必须是 effectively final。

---

### 2.5 各类函数式接口使用示例

**使用 Lambda 必须有上下文环境**，才能推导出 Lambda 对应的接口类型。以下按"无返回值"和"有返回值"两大类，覆盖全部 6 种情况。

#### 2.5.1 无返回值函数式接口

**情况一：无返回值无参数**

```java
// 定义函数式接口
interface NoParameterNoReturn {
    void test();
}

public class Test01 {
    public static void main(String[] args) {
        // 方式一：匿名内部类
        NoParameterNoReturn obj1 = new NoParameterNoReturn() {
            @Override
            public void test() {
                System.out.println("无参无返回值");
            }
        };
        obj1.test();

        // 方式二：Lambda 表达式
        NoParameterNoReturn obj2 = () -> System.out.println("无参无返回值");
        obj2.test();
    }
}
```

**情况二：无返回值一个参数**

```java
interface OneParameterNoReturn {
    void test(int num);
}

public class Test02 {
    public static void main(String[] args) {
        OneParameterNoReturn obj = num -> System.out.println("参数值：" + num);
        obj.test(10); // 输出：参数值：10
    }
}
```

**情况三：无返回值多个参数**

```java
interface MoreParameterNoReturn {
    void test(String str1, String str2);
}

public class Test03 {
    public static void main(String[] args) {
        MoreParameterNoReturn obj = (s1, s2) -> System.out.println(s1 + " : " + s2);
        obj.test("hello", "world"); // 输出：hello : world
    }
}
```

#### 2.5.2 有返回值函数式接口

**情况一：有返回值无参数**

```java
interface NoParameterHasReturn {
    int test();
}

public class Test04 {
    public static void main(String[] args) {
        NoParameterHasReturn obj = () -> 520; // 省略 return
        System.out.println(obj.test()); // 输出：520
    }
}
```

**情况二：有返回值一个参数**

```java
interface OneParameterHasReturn {
    String test(double num);
}

public class Test05 {
    public static void main(String[] args) {
        OneParameterHasReturn obj = num -> "传入的小数为：" + num;
        System.out.println(obj.test(3.14)); // 输出：传入的小数为：3.14
    }
}
```

**情况三：有返回值多个参数**

```java
interface MoreParameterHasReturn {
    String test(int num1, int num2);
}

public class Test06 {
    public static void main(String[] args) {
        MoreParameterHasReturn obj = (a, b) -> "运算结果：" + (a + b);
        System.out.println(obj.test(10, 20)); // 输出：运算结果：30
    }
}
```

---

## 3. 方法引用（进阶写法）

当 Lambda 方法体**仅调用一个已有方法**时，可升级为方法引用，使代码更精简。方法引用是 Lambda 的语法糖。

> **判断标准**：Lambda 方法体除了调用现有方法外什么都不做，即可使用方法引用。

**方法引用类型总览**：

| 类型 | 语法 | 说明 |
|------|------|------|
| 实例方法引用 | `对象 :: 实例方法` | 调用指定对象的实例方法 |
| 静态方法引用 | `类 :: 静态方法` | 调用类的静态方法 |
| 特殊方法引用 | `类名 :: 实例方法` | 将第一个参数作为调用者调用实例方法 |
| 构造方法引用 | `类名 :: new` | 调用构造方法创建对象 |
| 数组引用 | `数组类型 :: new` | 创建指定类型的数组 |

### 3.1 实例方法引用

**语法**：`对象 :: 实例方法`

**要求**：函数式接口抽象方法的返回值类型和参数列表，与实例方法的返回值类型和参数列表保持一致。

```java
// 示例1：System.out.println 方法引用
Consumer<String> consumer = System.out::println;
consumer.accept("hello world"); // 输出：hello world

// 示例2：调用对象实例方法
Teacher teacher = new Teacher("ande", 18);
Supplier<String> supplier = teacher::getName;
System.out.println(supplier.get()); // 输出：ande
```

### 3.2 静态方法引用

**语法**：`类 :: 静态方法`

**要求**：函数式接口抽象方法的返回值类型和参数列表，与静态方法的返回值类型和参数列表保持一致。

```java
// 示例：Math.round 静态方法引用
Function<Double, Long> function = Math::round;
System.out.println(function.apply(3.14)); // 输出：3
```

### 3.3 特殊方法引用

**语法**：`类名 :: 实例方法`

**要求**：函数式接口抽象方法的**第一个参数**作为方法调用者，第二个参数（或无参）对应被调用实例方法的参数列表，返回值类型保持一致。

```java
// 示例1：Double.compareTo 特殊方法引用
Comparator<Double> comparator = Double::compareTo;
System.out.println(comparator.compare(10.0, 20.0)); // 输出：负数

// 示例2：Teacher.getName 特殊方法引用
Function<Teacher, String> function = Teacher::getName;
Teacher t = new Teacher("ande", 18);
System.out.println(function.apply(t)); // 输出：ande
```

### 3.4 构造方法引用

**语法**：`类名 :: new`

**要求**：构造方法的参数列表与函数式接口抽象方法的参数列表保持一致，返回值类型与创建对象的类型一致。

```java
// 示例1：无参构造方法引用
Supplier<Teacher> supplier = Teacher::new;
System.out.println(supplier.get()); // 输出：Teacher{name='null', age=0}

// 示例2：有参构造方法引用
Function<String, Teacher> function = Teacher::new;
System.out.println(function.apply("ande")); // 输出：Teacher{name='ande', age=0}
```

### 3.5 数组引用

**语法**：`数组类型 :: new`

**要求**：函数式接口抽象方法只有一个 int 类型参数（数组长度），返回值类型为对应数组类型。

```java
Function<Integer, int[]> function = int[]::new;
int[] arr = function.apply(10);
System.out.println(Arrays.toString(arr)); // 输出：[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
```

---

## 4. 集合中的 Lambda 操作

JDK 1.8 为集合新增了若干配合 Lambda 使用的方法，**看懂源码中的函数式接口类型是正确使用的前提**。

### 4.1 forEach() 方法

| 集合类型 | forEach 参数类型 | 说明 |
|---------|----------------|------|
| `Collection`（List/Set） | `Consumer<T>` | 单参数消费型接口 |
| `Map` | `BiConsumer<K, V>` | 双参数消费型接口 |

```java
// List 遍历（三种写法对照）
List<Integer> list = Arrays.asList(11, 22, 33, 44, 55);
// 匿名内部类
list.forEach(new Consumer<Integer>() {
    @Override
    public void accept(Integer element) {
        System.out.println(element);
    }
});
// Lambda
list.forEach(element -> System.out.println(element));
// 方法引用（最精简）
list.forEach(System.out::println);

// Set 遍历
Set<String> set = new HashSet<>(Arrays.asList("aa", "bb", "cc"));
set.forEach(System.out::println);

// Map 遍历（三种写法对照）
Map<String, String> map = new HashMap<>();
map.put("张三", "成都");
map.put("李四", "重庆");
map.put("王五", "西安");
// 匿名内部类
map.forEach(new BiConsumer<String, String>() {
    @Override
    public void accept(String key, String value) {
        System.out.println("key：" + key + "，value：" + value);
    }
});
// Lambda
map.forEach((k, v) -> System.out.println("key：" + k + "，value：" + v));
```

### 4.2 removeIf() 方法

**参数类型**：`Predicate<T>`（判断型接口）

**说明**：返回 `true` 则删除该元素，返回 `false` 则保留。

```java
// List 条件删除（三种写法对照）
List<String> list = new ArrayList<>(Arrays.asList("aa", "bb", "cc", "dd"));
// 匿名内部类
list.removeIf(new Predicate<String>() {
    @Override
    public boolean test(String element) {
        return "bb".equals(element);
    }
});
System.out.println(list); // 输出：[aa, cc, dd]

// Lambda
list.removeIf(element -> "cc".equals(element));
System.out.println(list); // 输出：[aa, dd]

// 方法引用
list.removeIf("aa"::equals);
System.out.println(list); // 输出：[dd]

// Set 条件删除
Set<String> set = new HashSet<>(Arrays.asList("aa", "bb", "cc", "dd"));
set.removeIf("cc"::equals);
System.out.println(set); // 输出：[aa, bb, dd]
```

---

## 5. 四个内置函数式接口（必记）

Java 1.8 在 `java.util.function` 包中提供了大量内置函数式接口，**以下四个最常用，务必掌握**。

| 接口名 | 抽象方法 | 作用 | 典型场景 |
|--------|---------|------|---------|
| `Consumer<T>` | `void accept(T t)` | 消费型：有输入无输出 | forEach 遍历 |
| `Supplier<T>` | `T get()` | 供给型：无输入有输出 | 创建对象 |
| `Function<T, R>` | `R apply(T t)` | 函数型：有输入有输出 | 类型转换 |
| `Predicate<T>` | `boolean test(T t)` | 判断型：有输入返回布尔 | 条件过滤 |

> **记忆技巧**：只要看到这些接口出现的地方，都可以用 Lambda 表达式或方法引用来简化。

### 5.1 两个重要扩展接口

在上述四个接口基础上，`java.util.function` 还提供了两个常用的扩展操作符接口：

| 接口名 | 抽象方法 | 作用 | 与 Function 的区别 |
|--------|---------|------|-----------------|
| `UnaryOperator<T>` | `T apply(T t)` | 一元操作：T → T | 输入输出类型必须相同 |
| `BinaryOperator<T>` | `T apply(T t1, T t2)` | 二元操作：(T, T) → T | 输入两个同类型值，输出同类型值 |

**典型使用场景**：`List.sort()` 的第二个参数就是 `Comparator<T>`，其本质是 `BiFunction<T, T, Integer>`；而 Stream 的 `reduce()` 常用 `BinaryOperator`。

```java
// UnaryOperator 示例：取相反数
UnaryOperator<Integer> neg = n -> -n;
System.out.println(neg.apply(5)); // 输出：-5

// BinaryOperator 示例：求最大值
BinaryOperator<Integer> max = (a, b) -> a > b ? a : b;
System.out.println(max.apply(3, 7)); // 输出：7
```

### 5.2 Stream API 简述（配合 Lambda 使用）

Stream 是 JDK 1.8 提供的**流式数据处理 API**，与 Lambda 表达式配合使用，可以优雅地完成**过滤、映射、归约**等操作。

> **说明**：Stream API 本身是一个独立且庞大的主题，本节仅做简要提及，后续会有专题笔记详细讲解。

**核心特点**：
- **惰性计算**：中间操作（如 `filter`、`map`）不会立即执行，只有遇到终端操作（如 `forEach`、`collect`）时才会触发执行
- **链式调用**：可以像管道一样串联多个操作，代码清晰易读
- **支持并行**：通过 `parallelStream()` 轻松实现并行处理

**三步走模式**：

```java
List<String> names = Arrays.asList("Tom", "Jerry", "Mike", "Bob");

// 数据源 → 中间操作（过滤/映射）→ 终端操作（收集/遍历）
List<String> result = names.stream()        // 1. 数据源
    .filter(name -> name.length() > 3)      // 2. 中间操作：过滤长度大于3的
    .map(String::toUpperCase)               // 2. 中间操作：转为大写
    .collect(Collectors.toList());          // 3. 终端操作：收集为 List

System.out.println(result); // 输出：[JERRY, MIKE]
```

---

## 6. 原理与拓展

### 6.1 函数式编程思想

**面向对象思想（OOP）**：做一件事，先找到能做这件事的对象，调用对象的方法完成任务。**重视"谁来做"**。

**函数式编程思想**：只要能获得结果，谁做的、怎么做的都不重要，**重视结果，不重视过程**。

Java 从诞生起倡导"一切皆对象"，JDK 1.8 引入 Lambda 后，Java 也开始支持函数式编程（OOF）。

> **注意**：Lambda 表达式不是 Java 最早使用的，C++、C#、Python、Scala 等语言都支持 Lambda。

### 6.2 函数式接口详解

**定义**：接口中有且只有一个抽象方法，即为函数式接口。

- 推荐使用 `@FunctionalInterface` 注解标注，编译器会强制检查（有 0 个或多个抽象方法则编译报错）
- **即使不使用 `@FunctionalInterface` 注解，只要接口只有一个抽象方法，依然是函数式接口**

```java
@FunctionalInterface
public interface Flyable {
    void showFly();          // 唯一抽象方法（必须）
    default void show() {    // 可以有任意多个默认方法
        System.out.println("默认方法");
    }
    static void test() {     // 可以有任意多个静态方法
        System.out.println("静态方法");
    }
}
```

**Lambda 与函数式接口的关系**：**Lambda 表达式就是函数式接口的实例**。

```java
// 没有 @FunctionalInterface 注解，但只有一个抽象方法，依然是函数式接口
Flyable flyable = () -> System.out.println("小鸟自由飞翔");
flyable.showFly();
```

### 6.3 Lambda 与匿名内部类的区别

| 对比维度 | 匿名内部类 | Lambda 表达式 |
|---------|-----------|--------------|
| **所需类型** | 接口、抽象类、具体类均可 | 只能是接口 |
| **使用限制** | 接口有多个抽象方法也可用 | 接口必须有且仅有一个抽象方法 |
| **编译结果** | 生成单独的 `.class` 字节码文件 | 不生成单独的 `.class` 文件 |
| **this 引用** | this 指向匿名内部类自身的实例 | this 指向包围它的外围类实例 |

**this 引用的区别示例**：

```java
public class LambdaThisDemo {
    public Runnable r = () -> {
        System.out.println(this); // 打印外围类 LambdaThisDemo 的实例
    };

    public Runnable r2 = new Runnable() {
        @Override
        public void run() {
            System.out.println(this); // 打印 Runnable 实现类自身的实例
        }
    };
}
```

> **核心区别总结**：Lambda 只能用于函数式接口（单抽象方法接口）；匿名内部类适用范围更广。

---

