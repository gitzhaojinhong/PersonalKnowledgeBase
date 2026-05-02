

## 1. 快速上手（三步走模式）

Stream API 的使用遵循 **"创建流 → 中间操作 → 终止操作"** 三步模式。

### 1.1 三步走概述

**第一步：创建流** — 从数据源（集合、数组等）获取 Stream 对象

**第二步：中间操作** — 对数据源进行处理，返回新的 Stream（惰性执行）

**第三步：终止操作** — 触发真正执行，返回计算结果

> **注意**：中间操作是惰性执行，只有遇到终止操作时才会真正计算；终止操作执行后，Stream 就不能再使用了。

### 1.2 常用实操示例

```java
List<Student> list = StudentData.getStudentList();

// 经典三步走：过滤 → 映射 → 收集
List<String> names = list.stream()                      // 1. 创建流
    .filter(stu -> stu.getAge() > 20)                   // 2. 中间操作：过滤年龄大于20
    .map(Student::getName)                               // 2. 中间操作：提取名字
    .collect(Collectors.toList());                        // 3. 终止操作：收集为List

System.out.println(names); // 输出：[张三, 王五, 赵六]
```

---

## 2. 创建 Stream 的方式

### 2.1 通过 Collection 接口创建

```java
List<String> list = Arrays.asList("aa", "bb", "cc");
Stream<String> stream = list.stream();
```

### 2.2 通过 Arrays 类创建

```java
// String 数组
String[] arr1 = {"aa", "bb", "cc"};
Stream<String> stringStream = Arrays.stream(arr1);

// int 数组 → IntStream
int[] arr2 = {11, 22, 33, 44};
IntStream intStream = Arrays.stream(arr2);

// long 数组 → LongStream
long[] arr3 = {11, 22, 33, 44};
LongStream longStream = Arrays.stream(arr3);

// double 数组 → DoubleStream
double[] arr4 = {1.0, 2.0, 3.0};
DoubleStream doubleStream = Arrays.stream(arr4);
```

> **注意**：Stream、IntStream、LongStream、DoubleStream 都继承于 BaseStream 接口。

### 2.3 通过 Stream.of() 创建

```java
Stream<String> stringStream = Stream.of("aa", "bb", "cc");
Stream<Integer> integerStream = Stream.of(11, 22, 33, 44);
```

### 2.4 顺序流与并行流

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| **顺序流** | 单线程顺序处理 | 有顺序要求、数据量较小 |
| **并行流** | 多线程并行处理 | 无顺序要求、数据量较大、可提升效率 |

```java
// 方式一：parallel() 转换
Stream<String> stream = Stream.of("aa", "bb", "cc");
Stream<String> parallelStream = stream.parallel();
System.out.println(stream.isParallel()); // 输出：true

// 方式二：parallelStream() 直接创建（常用）
List<String> list = Arrays.asList("aa", "bb", "cc");
Stream<String> parallel = list.parallelStream();
System.out.println(parallel.isParallel()); // 输出：true
```

> **优势**：使用并行流无需编写多线程代码，即可享受并行处理带来的效率提升。

---

## 3. 中间操作（惰性执行）

> 以下所有操作都是惰性的，只有触发终止操作时才会真正执行。

### 3.1 筛选（filter）

**语法**：`Stream<T> filter(Predicate<? super T> predicate)`

```java
// 需求：筛选出年龄大于20的学生
StudentData.getStudentList().stream()
    .filter(stu -> stu.getAge() > 20)
    .forEach(System.out::println);

// 需求：筛选字符串长度大于3的元素
Stream.of("hello", "too", "like", "ande")
    .filter(str -> str.length() > 3)
    .forEach(System.out::println);
```

### 3.2 映射（map / flatMap）

**map 语法**：`<R> Stream<R> map(Function<? super T, ? extends R> mapper)`

```java
// 需求：把字符串全部转为大写
Stream.of("hello", "too", "like", "ande")
    .map(String::toUpperCase)
    .forEach(System.out::println);

// 需求：获取所有学生的名字
StudentData.getStudentList().stream()
    .map(Student::getName)
    .forEach(System.out::println);

// 需求：获取性别为男的学生名字
StudentData.getStudentList().stream()
    .filter(stu -> "男".equals(stu.getSex()))
    .map(Student::getName)
    .forEach(System.out::println);
```

**映射到原始类型流**（避免装箱拆箱开销）：

| 方法 | 返回类型 | 说明 |
|------|---------|------|
| `mapToInt(ToIntFunction)` | `IntStream` | 映射为 int 流 |
| `mapToLong(ToLongFunction)` | `LongStream` | 映射为 long 流 |
| `mapToDouble(ToDoubleFunction)` | `DoubleStream` | 映射为 double 流 |

```java
// 需求：获取所有学生年龄的 int 流
IntStream ages = StudentData.getStudentList().stream()
    .mapToInt(Student::getAge);

// 需求：计算所有学生年龄之和（避免自动装箱）
int totalAge = StudentData.getStudentList().stream()
    .mapToInt(Student::getAge)
    .sum();
System.out.println(totalAge);

// 需求：获取所有学生年龄的平均值
double avgAge = StudentData.getStudentList().stream()
    .mapToInt(Student::getAge)
    .average()
    .getAsDouble();
System.out.println(avgAge);
```

**flatMap 语法**：`<R> Stream<R> flatMap(Function<? super T, ? extends Stream<? extends R>> mapper)`

> **区别**：map 将元素映射为单个值；flatMap 将元素映射为流，再合并成一个流。

```java
// 需求：将两个集合中的元素合并到同一个流
List<String> list1 = new ArrayList<>(Arrays.asList("aa", "bb", "cc"));
List<String> list2 = new ArrayList<>(Arrays.asList("dd", "ee", "ff"));

Stream.of(list1, list2)
    .flatMap(List::stream)
    .forEach(System.out::println);
// 输出：aa bb cc dd ee ff
```

**flatMapToInt/Long/Double**（展平为原始类型流）：

```java
// 需求：将多个 int 集合合并为一个 IntStream
List<int[]> listOfIntArrays = Arrays.asList(
    new int[]{1, 2},
    new int[]{3, 4},
    new int[]{5, 6}
);

IntStream.concat(
    IntStream.concat(IntStream.of(1, 2), IntStream.of(3, 4)),
    IntStream.of(5, 6)
).forEach(System.out::println);

// 更实用的示例：计算所有数组的元素总和
int[][] matrix = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
int sum = Arrays.stream(matrix)
    .flatMapToInt(Arrays::stream)
    .sum();
System.out.println(sum); // 输出：45
```

### 3.3 窥视（peek）

**语法**：`Stream<T> peek(Consumer<? super T> action)`

> **作用**：查看流中的每个元素，不改变流本身。常用于**调试**，查看中间操作的效果。

```java
// 需求：调试 filter 操作，查看过滤前后的数据
Stream.of("hello", "too", "like", "ande")
    .peek(s -> System.out.println("过滤前：" + s))
    .filter(s -> s.length() > 3)
    .peek(s -> System.out.println("过滤后：" + s))
    .forEach(System.out::println);

/*
输出：
过滤前：hello
过滤后：hello
hello
过滤前：too
过滤前：like
过滤后：like
like
过滤前：ande
*/

// 需求：调试收集操作
List<String> result = StudentData.getStudentList().stream()
    .peek(stu -> System.out.println("原始数据：" + stu))
    .filter(stu -> stu.getAge() > 20)
    .peek(stu -> System.out.println("年龄过滤后：" + stu))
    .map(Student::getName)
    .peek(name -> System.out.println("名字映射后：" + name))
    .collect(Collectors.toList());
```

### 3.4 除重（distinct）

**语法**：`Stream<T> distinct()` — 底层使用 `hashCode()` 和 `equals()` 判断元素是否相等

```java
// 需求：除去重复的整数
Stream.of(11, 22, 33, 44, 33)
    .distinct()
    .forEach(System.out::println);

// 需求：除去重复的学生对象
StudentData.getStudentList().stream()
    .distinct()
    .forEach(System.out::println);

// 需求：除去年龄相同的学生（返回年龄）
StudentData.getStudentList().stream()
    .map(Student::getAge)
    .distinct()
    .forEach(System.out::println);
```

### 3.5 排序（sorted）

**自然排序语法**：`Stream<T> sorted()` — 元素类必须实现 `Comparable` 接口

**指定排序语法**：`Stream<T> sorted(Comparator<? super T> comparator)`

```java
// 自然排序：整数升序
Stream.of(4, 1, 3, 6, 2, 5)
    .sorted()
    .forEach(System.out::println);

// 自然排序：学生按年龄升序（Student需实现Comparable）
StudentData.getStudentList().stream()
    .sorted()
    .forEach(System.out::println);

// 指定排序：整数降序
Stream.of(4, 1, 3, 6, 2, 5)
    .sorted(Integer::compare)
    .forEach(System.out::println);

// 指定排序：学生按年龄降序
StudentData.getStudentList().stream()
    .sorted((s1, s2) -> s2.getAge() - s1.getAge())
    .forEach(System.out::println);

// 指定排序：学生按年龄升序（方法引用）
StudentData.getStudentList().stream()
    .sorted(Comparator.comparing(Student::getAge))
    .forEach(System.out::println);
```

### 3.6 截断与跳过（limit / skip）

| 方法 | 作用 |
|------|------|
| `limit(n)` | 截取前 n 个元素 |
| `skip(n)` | 跳过前 n 个元素 |

```java
// 需求：从索引2开始，截取3个元素
Stream.of(11, 22, 33, 44, 55, 66)
    .skip(2)
    .limit(3)
    .forEach(System.out::println);
// 输出：33 44 55

// 需求：获取前3个学生
StudentData.getStudentList().stream()
    .limit(3)
    .forEach(System.out::println);
```

### 3.7 合并（concat）

**语法**：`public static <T> Stream<T> concat(Stream<? extends T> a, Stream<? extends T> b)`

```java
Stream<String> stream1 = Stream.of("aa", "bb", "cc");
Stream<String> stream2 = Stream.of("11", "22", "33");

Stream.concat(stream1, stream2)
    .forEach(System.out::println);
// 输出：aa bb cc 11 22 33
```

---

## 4. 终止操作（触发执行）

> 终止操作会触发中间操作的真正执行，并返回计算结果。

### 4.1 遍历（forEach / forEachOrdered）

**forEach 语法**：`void forEach(Consumer<? super T> action)`
- **并行流中**：不保证遍历顺序
- **顺序流中**：按流顺序遍历

**forEachOrdered 语法**：`void forEachOrdered(Consumer<? super T> action)`
- **保证**：按流原本的 encounter order 顺序遍历
- **适用场景**：并行流中需要保证顺序时使用

```java
List<Integer> list = Arrays.asList(1, 2, 3, 4, 5);

// forEach：并行流中顺序不确定
list.parallelStream().forEach(System.out::print); // 输出可能：31524

// forEachOrdered：并行流中也能保证顺序
list.parallelStream().forEachOrdered(System.out::print); // 输出：12345
```

**常用遍历示例**：

```java
List<Student> list = StudentData.getStudentList();

// 遍历所有学生
list.stream().forEach(System.out::println);

// 遍历年龄大于20的学生
list.stream()
    .filter(stu -> stu.getAge() > 20)
    .forEach(System.out::println);
```

### 4.2 匹配（match）与查找（find）

| 方法 | 说明 |
|------|------|
| `allMatch(Predicate)` | 是否匹配所有元素 |
| `anyMatch(Predicate)` | 是否至少匹配一个元素 |
| `noneMatch(Predicate)` | 是否所有都不匹配 |
| `findFirst()` | 获取第一个元素（返回 Optional） |
| `findAny()` | 获取任意一个元素（并行流中更有优势） |

```java
List<Student> list = StudentData.getStudentList();

// 是否所有学生名字都是"王五"
boolean allMatch = list.stream()
    .allMatch(stu -> "王五".equals(stu.getName()));
System.out.println(allMatch); // false

// 是否有学生名字是"王五"
boolean anyMatch = list.stream()
    .anyMatch(stu -> "王五".equals(stu.getName()));
System.out.println(anyMatch); // true

// 是否所有学生名字都不是"王五"
boolean noneMatch = list.stream()
    .noneMatch(stu -> "王五".equals(stu.getName()));
System.out.println(noneMatch); // false

// 获取第一个学生
Student first = list.stream().findFirst().get();
System.out.println(first);

// 获取第4个学生（跳过前3个）
Student fourth = list.stream().skip(3).findFirst().get();
System.out.println(fourth);
```

> **Optional 说明**：Optional 是值的容器，用于避免空指针异常。使用 `.get()` 方法获取实际值。

### 4.3 统计（count / max / min）

```java
List<Student> list = StudentData.getStudentList();

// 统计元素个数
long count = list.stream().count();
System.out.println(count);

// 获取年龄最大的学生
Student maxStudent = list.stream()
    .max((s1, s2) -> s1.getAge() - s2.getAge())
    .get();
System.out.println(maxStudent);

// 获取年龄最大的值
Integer maxAge = list.stream()
    .map(Student::getAge)
    .max(Integer::compare)
    .get();
System.out.println(maxAge);

// 获取年龄最小的学生
Student minStudent = list.stream()
    .min((s1, s2) -> s1.getAge() - s2.getAge())
    .get();
System.out.println(minStudent);

// 获取年龄最小的值
Integer minAge = list.stream()
    .map(Student::getAge)
    .min(Integer::compare)
    .get();
System.out.println(minAge);
```

### 4.4 归约（reduce）

**语法**：
- `Optional<T> reduce(BinaryOperator<T> accumulator)`
- `T reduce(T identity, BinaryOperator<T> accumulator)`

```java
List<Integer> list = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9);

// 求和（方式一）
Integer sum = list.stream().reduce(Integer::sum).get();
System.out.println(sum); // 45

// 求和（方式二：有初始值，返回Integer而非Optional）
Integer sum2 = list.stream().reduce(10, Integer::sum);
System.out.println(sum2); // 55

// 求积
Integer product = list.stream().reduce((x, y) -> x * y).get();
System.out.println(product); // 362880

// 获取最长字符串
String longest = Stream.of("I", "love", "you", "too")
    .reduce((s1, s2) -> s1.length() > s2.length() ? s1 : s2)
    .get();
System.out.println(longest); // love

// 求所有学生总年龄
Integer totalAge = StudentData.getStudentList().stream()
    .map(Student::getAge)
    .reduce((age1, age2) -> age1 + age2)
    .get();
System.out.println(totalAge);
```

> **核心思想**：reduce 将所有元素按照指定规则合并成一个结果。count、max、min 本质上都是 reduce 的特例。

---

## 5. 收集操作（collect）

**语法**：`<R, A> R collect(Collector<? super T, A, R> collector)`

收集是 Stream 最丰富的部分，可以将流收集为值或新集合。

### 5.1 归集（toList / toSet / toMap）

```java
// 转化为 List
List<String> list = Stream.of("I", "love", "you", "too")
    .collect(Collectors.toList());

// 转化为 Set（自动去重）
Set<String> set = Stream.of("I", "love", "you", "too", "love")
    .collect(Collectors.toSet());

// 转化为 Map（字符串以":"分割，左边为key，右边为value）
Map<String, String> map = Stream.of("张三:成都", "李四:武汉", "王五:重庆")
    .collect(Collectors.toMap(
        s -> s.substring(0, s.indexOf(":")),      // key
        s -> s.substring(s.indexOf(":") + 1)       // value
    ));
map.forEach((k, v) -> System.out.println("key：" + k + "，value：" + v));
```

### 5.2 指定集合类型（toCollection）

```java
List<String> source = Arrays.asList("I", "love", "you", "too");

// 转化为 ArrayList
ArrayList<String> arrayList = source.stream()
    .collect(Collectors.toCollection(ArrayList::new));

// 转化为 LinkedList
LinkedList<String> linkedList = source.stream()
    .collect(Collectors.toCollection(LinkedList::new));

// 转化为 HashSet
HashSet<String> hashSet = source.stream()
    .collect(Collectors.toCollection(HashSet::new));

// 转化为 TreeSet（自动排序）
TreeSet<String> treeSet = source.stream()
    .collect(Collectors.toCollection(TreeSet::new));
```

### 5.3 转换为数组（toArray）

```java
List<String> list = Arrays.asList("aa", "bb", "cc", "dd");

// 转化为 Object 数组
Object[] array1 = list.stream().toArray();

// 转化为指定类型数组
String[] array2 = list.stream().toArray(String[]::new);
System.out.println(Arrays.toString(array2)); // [aa, bb, cc, dd]
```

### 5.4 统计分析（counting / averaging / summing / summarizing）

| 方法 | 说明 |
|------|------|
| `counting()` | 计数 |
| `averagingInt/Long/Double()` | 计算平均值 |
| `summingInt/Long/Double()` | 求和 |
| `maxBy()/minBy()` | 获取最值 |
| `summarizingInt/Long/Double()` | 统计所有信息 |

```java
List<Student> list = StudentData.getStudentList();

// 计数
Long count = list.stream().collect(Collectors.counting());
System.out.println(count);

// 平均年龄
Double avgAge = list.stream().collect(Collectors.averagingDouble(Student::getAge));
System.out.println(avgAge);

// 最大年龄的学生
Student oldest = list.stream()
    .collect(Collectors.maxBy((s1, s2) -> s1.getAge() - s2.getAge()))
    .get();
System.out.println(oldest);

// 年龄之和
Long sumAge = list.stream().collect(Collectors.summingLong(Student::getAge));
System.out.println(sumAge);

// 获取完整的统计信息
IntSummaryStatistics stats = list.stream()
    .collect(Collectors.summarizingInt(Student::getAge));
System.out.println(stats);
// 输出：IntSummaryStatistics{count=5, sum=102, min=16, average=20.400000, max=25}
```

### 5.5 分组（groupingBy）

```java
List<Student> list = StudentData.getStudentList();

// 按性别分组
Map<String, List<Student>> bySex = list.stream()
    .collect(Collectors.groupingBy(Student::getSex));
bySex.forEach((k, v) -> System.out.println(k + "：" + v));

// 按年龄分组
Map<Integer, List<Student>> byAge = list.stream()
    .collect(Collectors.groupingBy(Student::getAge));

// 多级分组：先按性别，再按城市
Map<String, Map<String, List<Student>>> bySexAndCity = list.stream()
    .collect(Collectors.groupingBy(Student::getSex,
        Collectors.groupingBy(Student::getCity)));
```

### 5.6 分区（partitioningBy）

> 分区是分组的特例，只分为 true 和 false 两组。

```java
List<Student> list = StudentData.getStudentList();

// 按年龄是否大于20分区
Map<Boolean, List<Student>> partitioned = list.stream()
    .collect(Collectors.partitioningBy(stu -> stu.getAge() > 20));

System.out.println("年龄大于20：" + partitioned.get(true));
System.out.println("年龄小于等于20：" + partitioned.get(false));
```

### 5.7 接合（joining）

```java
List<Student> list = StudentData.getStudentList();

// 将所有学生名字拼接成字符串（逗号分隔）
String names = list.stream()
    .map(Student::getName)
    .collect(Collectors.joining(", "));
System.out.println(names); // 张三, 李四, 王五, 赵六, 王麻子

// 使用分隔符
String joined = list.stream()
    .map(Student::getName)
    .collect(Collectors.joining(" | "));
System.out.println(joined); // 张三 | 李四 | 王五 | 赵六 | 王麻子
```

### 5.8 规约收集（reducing）

> `reducing` 是最通用的规约收集器，其他收集器（如 `summingInt`、`maxBy`）本质上都是它的特例。

| 方法 | 说明 |
|------|------|
| `reducing(BinaryOperator<T>)` | 无初始值，返回 `Optional<T>` |
| `reducing(T identity, BinaryOperator<T>)` | 带初始值 |
| `reducing(U, Function<T,U>, BinaryOperator<U>)` | 映射后规约 |

```java
List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5);

// 使用 reducing 求和
Integer sum = numbers.stream()
    .collect(Collectors.reducing(Integer::sum))
    .orElse(0);
System.out.println(sum); // 15

// 带初始值（返回 Integer 而非 Optional）
Integer sumWithInit = numbers.stream()
    .collect(Collectors.reducing(10, Integer::sum));
System.out.println(sumWithInit); // 25

// 映射后规约：求所有学生年龄之和
Integer totalAge = StudentData.getStudentList().stream()
    .collect(Collectors.reducing(
        0,                    // 初始值
        Student::getAge,     // 映射函数
        Integer::sum         // 规约函数
    ));
System.out.println(totalAge); // 102
```

### 5.9 映射收集（mapping）

> 先对元素应用映射函数，再将结果传递给下游收集器。常用于 `groupingBy` 的下游。

```java
// 需求：按性别分组，只保留学生姓名
Map<String, List<String>> namesBySex = StudentData.getStudentList().stream()
    .collect(Collectors.groupingBy(
        Student::getSex,
        Collectors.mapping(Student::getName, Collectors.toList())
    ));
System.out.println(namesBySex);
// 输出：{女=[李四, 王五, 王麻子], 男=[张三, 赵六]}

// 需求：按城市分组，统计每个城市的学生人数
Map<String, Long> countByCity = StudentData.getStudentList().stream()
    .collect(Collectors.groupingBy(
        Student::getCity,
        Collectors.mapping(s -> s, Collectors.counting())
    ));
// 等价于：
Map<String, Long> countByCity2 = StudentData.getStudentList().stream()
    .collect(Collectors.groupingBy(Student::getCity, Collectors.counting()));
```

### 5.10 结果转换（collectingAndThen）

> 收集完成后，对结果再应用一个转换函数。常用于生成不可变集合。

```java
// 需求：收集为不可修改的 List
List<String> immutableList = Stream.of("a", "b", "c")
    .collect(Collectors.collectingAndThen(
        Collectors.toList(),
        Collections::unmodifiableList
    ));

// 需求：收集后转为字符串
String result = Stream.of("hello", "world")
    .collect(Collectors.collectingAndThen(
        Collectors.joining("-"),
        s -> "[" + s + "]"
    ));
System.out.println(result); // [hello-world]
```

### 5.11 综合案例

```java
// 需求：获取年龄大于18岁的女同学，按年龄升序返回ArrayList
List<Student> result = StudentData.getStudentList().stream()
    .filter(stu -> stu.getAge() > 18)                      // 过滤年龄>18
    .filter(stu -> "女".equals(stu.getSex()))               // 过滤女性
    .sorted(Comparator.comparing(Student::getAge))         // 按年龄升序
    .collect(Collectors.toCollection(ArrayList::new));      // 收集为ArrayList

result.forEach(System.out::println);
```

---

## 6. Stream 进阶与原理

### 6.1 Stream 与 Collection 的区别

| 对比维度 | Collection | Stream API |
|---------|------------|------------|
| **数据存储** | 静态的内存数据结构 | 不存储数据 |
| **操作类型** | 面向内存（数据） | 面向 CPU（计算） |
| **使用方式** | 直接操作数据 | 惰性求值、链式操作 |
| **遍历次数** | 可多次遍历 | 只能消费一次 |

> **总结**：Collection 面向内存，存储数据；Stream 面向 CPU，处理数据。

### 6.2 Stream 的重要特点

1. **不存储元素**：Stream 自己不会存储元素，只对元素进行计算
2. **不改变源数据**：Stream 不会改变原始集合，可能返回持有结果的新 Stream
3. **延迟执行**：中间操作是惰性的，只有终止操作时才真正执行
4. **一次性使用**：Stream 一旦执行终止操作后，就不能再使用了

### 6.3 并行流原理

```java
// 顺序流与并行流的对比
List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

// 顺序流：单线程执行
long start1 = System.currentTimeMillis();
long sum1 = numbers.stream().reduce(0, Integer::sum);
System.out.println("顺序流耗时：" + (System.currentTimeMillis() - start1) + "ms，结果：" + sum1);

// 并行流：多线程执行（数据量大时效率提升明显）
long start2 = System.currentTimeMillis();
long sum2 = numbers.parallelStream().reduce(0, Integer::sum);
System.out.println("并行流耗时：" + (System.currentTimeMillis() - start2) + "ms，结果：" + sum2);
```

> **何时使用并行流**：数据量较大、元素之间无依赖关系、且不需要保证顺序时，并行流可以显著提升性能。

### 6.4 Optional 类的使用

Optional 是 JDK 8 引入的"值容器"，可以避免空指针异常。

```java
// 创建 Optional
Optional<String> empty = Optional.empty();
Optional<String> of = Optional.of("hello");
Optional<String> nullable = Optional.ofNullable(null);

// 安全获取值
String value = optional.orElse("默认值");        // 如果为空，返回默认值
String value2 = optional.orElseGet(() -> "计算值"); // 如果为空，执行供给型Lambda
optional.orElseThrow(RuntimeException::new);     // 如果为空，抛出异常

// 判断并获取
Optional<Student> oldest = list.stream()
    .filter(stu -> stu.getAge() > 30)
    .findFirst();
    
// 方式一：ifPresent
oldest.ifPresent(stu -> System.out.println(stu.getName()));

// 方式二：map + orElse
String name = oldest.map(Student::getName).orElse("未找到");
```

---

## 附：完整学习目标对照

| 知识点 | 要求 | 本章覆盖情况 |
|--------|------|-------------|
| Stream API 的概述 | 理解 | ✅ 第一、六章详解 |
| 创建 Stream 的方式 | 掌握 | ✅ 第二章详解 |
| Stream 的中间操作 | 掌握 | ✅ 第三章详解 |
| Stream 的终止操作 | 掌握 | ✅ 第四、五章详解 |
| Collectors 收集器 | 掌握 | ✅ 第五章详解 |

---

## 附：Student 数据模型

```java
public class Student {
    private String name;
    private int age;
    private String sex;
    private String city;

    public Student() {}

    public Student(String name, int age, String sex, String city) {
        this.name = name;
        this.age = age;
        this.sex = sex;
        this.city = city;
    }

    // getter / setter

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getAge() { return age; }
    public void setAge(int age) { this.age = age; }
    public String getSex() { return sex; }
    public void setSex(String sex) { this.sex = sex; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    @Override
    public String toString() {
        return "Student{name='" + name + "', age=" + age + ", sex='" + sex + "', city='" + city + "'}";
    }
}

public class StudentData {
    public static List<Student> getStudentList() {
        List<Student> list = new ArrayList<>();
        list.add(new Student("张三", 21, "男", "武汉"));
        list.add(new Student("李四", 18, "女", "重庆"));
        list.add(new Student("王五", 25, "女", "成都"));
        list.add(new Student("赵六", 22, "男", "武汉"));
        list.add(new Student("王麻子", 16, "女", "成都"));
        return list;
    }
}
```
