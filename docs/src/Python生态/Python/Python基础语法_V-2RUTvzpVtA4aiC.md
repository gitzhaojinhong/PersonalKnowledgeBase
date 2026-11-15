# Python基础语法

## 关键字

| 类别 | 关键字 | 说明 |
| --- | --- | --- |
| 逻辑值 | True | 布尔真值 |
| | False | 布尔假值 |
| | None | 表示空值或无值 |
| 逻辑运算 | and | 逻辑与运算 |
| | or | 逻辑或运算 |
| | not | 逻辑非运算 |
| 条件控制 | if | 条件判断语句 |
| | elif | 否则如果（else if 的缩写） |
| | else | 否则分支 |
| 循环控制 | for | 迭代循环 |
| | while | 条件循环 |
| | break | 跳出循环 |
| | continue | 跳过当前循环的剩余部分，进入下一次迭代 |
| 异常处理 | try | 尝试执行代码块 |
| | except | 捕获异常 |
| | finally | 无论是否发生异常都会执行的代码块 |
| | raise | 抛出异常 |
| 函数定义 | def | 定义函数 |
| | return | 从函数返回值 |
| | lambda | 创建匿名函数 |
| 类与对象 | class | 定义类 |
| | del | 删除对象引用 |
| 模块导入 | import | 导入模块 |
| | from | 从模块导入特定部分 |
| | as | 为导入的模块或对象创建别名 |
| 作用域 | global | 声明全局变量 |
| | nonlocal | 声明非局部变量（用于嵌套函数） |
| 异步编程 | async | 声明异步函数 |
| | await | 等待异步操作完成 |
| 其他 | assert | 断言，用于测试条件是否为真 |
| | in | 检查成员关系 |
| | is | 检查对象身份（是否是同一个对象） |
| | pass | 空语句，用于占位 |
| | with | 上下文管理器，用于资源管理 |
| | yield | 从生成器函数返回值 |

## 基本数据类型

### Number(不可变)

整型：int                  -> `i = 10`

浮点型：float            -> `f = 1.11`

复数：complex         -> `c = 1 + 11j` 或  `c =  complex(1, 11)`

### strr(不可变)

`s = "Hello Word!"`

| 操作 | 作用 |
| --- | --- |
| `s[0]`   -> 结果为'H' | 获取字符 |
| `s[0:3]` -> 结果为"Hel"   或 三个参数设置步长 | 截取子字符串 '左闭右开' |
| `r'\n'`      -> 结果为'\n' | 原始字符串 |
| `"我叫 %s 今年 %d 岁!" % ('小明', 10)` | 字符串格式化 |
| `name = 'Runoob'   f'Hello {name}'`# 替换变量 | f-string字符串格式化 |

### tupler(不可变)

<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">元组与列表类似，不同之处在于元组的元素不能修改。</font>

<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">元组中只包含一个元素时，需要在元素后面添加逗号 </font>**<font style="color:rgb(51, 51, 51);background-color:rgb(236, 234, 230);">,</font>**<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);"> ，否则括号会被当作运算符使用</font>

`tup1 = (1, 2, 3, 4, 5 )`

`tup2 = ()`

`tup3 = (1,)`

| 操作 | 作用 |
| --- | --- |
| `tup[0]` | 查询 |
| `del tup` | 删除整个元组 |
| `tup[0,2]`或 三个参数设置步长 | 截取元组 |

### list(可变)

`list = [1, 2, 3, 4, 5 ]`

| 操作 | 作用 |
| --- | --- |
| `list[0]` | 查询 |
| `list[0] = 100` | 修改 |
| `list.append(object)` | 在末尾新增 |
| `list.insert(index,object)` | 在指定位置新增 |
| `del list[0]` 或 `list.pop(0)` | 根据索引删除 |
| `list.remove(object)` | 删除第一个匹配项 |
| `list[0:2]`或 三个参数设置步长 | 截取列表 |

### dict(可变)

字典(dict) 存储键值对

`d = {key1 : value1, key2 : value2, key3 : value3 }`

`emptyDict = {}`

| 操作 | 作用 |
| --- | --- |
| `d[key1]`或 `d.get(key)` | 查询value |
| `d[key1] = object` | 修改/新增 键值对 |
| `del d[key1]`或 `d.pop(key)` | 删除一个键值对 |

### set(可变)

<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">集合（set）是一个无序的不重复元素序列。</font>

<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">创建一个空集合必须用</font>**<font style="color:rgb(51, 51, 51);background-color:rgb(236, 234, 230);"> set()</font>**<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);"> 而不是 </font>**<font style="color:rgb(51, 51, 51);background-color:rgb(236, 234, 230);">{ }</font>**<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">，因为 </font>**<font style="color:rgb(51, 51, 51);background-color:rgb(236, 234, 230);">{ }</font>**<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);"> 是用来创建一个空字典。</font>

`set1 = {value01,value02,...}`

`set2 = set([4, 5, 6, 7])`

`set3 = set()`

| 操作 | 作用 |
| --- | --- |
| `s.add(object)` | 新增 |
| `s.remove(object)`<br/>或`s.discard(object)` | 删除 |
| `set1.intersection(set2)` | 交 |
| `set1.union(set2)` | 并 |
| `set1.difference(set2)` | 差 |

## 条件控制

### if...else...

```python
if x:
    pass
elif y:
    pass
else:
    pass
```

> `pass`: 空语句，占位用，保证语法完整

### match...case...

```python
match month:
        # 3、4、5月 → 春季
        case 3 | 4 | 5:
            return "春季"
        # 6、7、8月 → 夏季
        case 6 | 7 | 8:
            return "夏季"
        # 9、10、11月 → 秋季
        case 9 | 10 | 11:
            return "秋季"
        # 12、1、2月 → 冬季
        case 12 | 1 | 2:
            return "冬季"
        # 其他非法月份
        case _:
            return "月份输入错误"
```

> **<font style="color:rgb(51, 51, 51);background-color:rgb(236, 234, 230);">case \_:</font>**<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);"> 类似于 C 和 Java 中的 </font>**<font style="color:rgb(51, 51, 51);background-color:rgb(236, 234, 230);">default:</font>**<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">，当其他 case 都无法匹配时，匹配这条，保证永远会匹配成功。</font>

## <font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">循环</font>

### for

```python
# range生成序列
for i in range(1, 6):
    if i == 3:
        continue  # 跳过i=3，直接下一轮
    if i== 5
        break     # 结束循环
else:             # 如果触发break，else不会触发
    print("for循环正常执行完毕，没有触发break")
print("循环结束")

```

### while

```python
# range生成序列
i = 1
while i < 6:
    if i == 3:
        i += 1
        continue  # 跳过i=3，直接下一轮
    if i == 5:
        break     # 结束循环
    i += 1
else:             # 如果触发break，else不会触发
    print("while循环正常执行完毕，没有触发break")
print("循环结束")

```

## 推导式

**推导式** 是一种从一个数据序列快速构建另一个新数据序列的简洁语法。

\*\*核心思想 \*\*是把"循环遍历 + 条件过滤 + 表达式变换"浓缩成一行。

### 列表(list)推导式

使用 `[]`

基本格式为 <code><font style="color:rgb(0, 0, 0);">[表达式 for 变量 in 列表 if 条件]</font></code>

```python
names = ['Bob', 'Tom', 'alice', 'Jerry', 'Wendy', 'Smith']
new_names = [name.upper() for name in names if len(name) > 3]
print(new_names)   # ['ALICE', 'JERRY', 'WENDY', 'SMITH']
```

### 字典(dict)推导式

使用`{}`

基本格式为 <code><font style="color:rgb(0, 0, 0);">{key_expr: value_expr for value in collection if 条件}</font></code>

```python
dic = {x: x**2 for x in (2, 4, 6)}
print(dic)          # {2: 4, 4: 16, 6: 36}
print(type(dic))    # <class 'dict'>
```

### 集合(set)推导式

使用`{}`

基本格式为 <code><font style="color:rgb(0, 0, 0);">{expression for item in Sequence if 条件}</font></code>

<font style="color:rgb(0, 0, 0);">与字典推导式的区别在于</font>**<font style="color:rgb(0, 0, 0);">不包含冒号组成的键值对</font>**<font style="color:rgb(0, 0, 0);">，只保留单个表达式。  </font>

```python
a = {x for x in 'abracadabra' if x not in 'abc'}
print(a)          # {'d', 'r'}
print(type(a))    # <class 'set'>
```

### 元组(tuple)推导式

使用`()`

基本格式为 <code><font style="color:rgb(0, 0, 0);">(expression for item in Sequence if 条件)</font></code>

它是最特殊的一类：**<font style="color:rgb(0, 0, 0);">返回的不是元组，而是一个生成器（generator）对象</font>**，需要借助 <code><font style="color:rgb(0, 0, 0);">tuple()</font></code> 函数转换才能得到真正的元组，这也是它常被称为"生成器表达式"的原因。

```python
a = (x for x in range(1, 10))
print(a)          # <generator object <genexpr> at 0x...>
print(tuple(a))   # (1, 2, 3, 4, 5, 6, 7, 8, 9)
```

## 迭代器与生成器

### 迭代器

迭代器是访问集合元素的核心方式。迭代器对象从集合的第一个元素开始访问，直到所有元素被访问完为止，并且\_<font style="color:rgb(0, 0, 0);">只能往前不会后退</font>\_。

```python
list = [1, 2, 3, 4]
it = iter(list)
for x in it:
    print(x, end=" ")    # 输出: 1 2 3 4
```

**自定义迭代器**

> 把一个类作为迭代器使用，需要在类中实现两个方法：<code><font style="color:rgb(0, 0, 0);">__iter__()</font></code> 返回迭代器对象本身（并完成初始化），<code><font style="color:rgb(0, 0, 0);">__next__()</font></code> 返回下一个元素并在适当时机抛出 <code><font style="color:rgb(0, 0, 0);">StopIteration</font></code> 标识迭代完成。

```python
class MyNumbers:
    def __iter__(self):
        self.a = 1
        return self

    def __next__(self):
        if self.a <= 20:          # 在 20 次迭代后停止
            x = self.a
            self.a += 1
            return x
        else:
            raise StopIteration   # 触发异常结束迭代，防止无限循环

myclass = MyNumbers()
myiter = iter(myclass)
for x in myiter:
    print(x)                      # 输出 1 到 20
```

### 生成器

> 生成器的核心是 <code><font style="color:rgb(0, 0, 0);">yield</font></code> 关键字。当生成器函数执行到 <code><font style="color:rgb(0, 0, 0);">yield</font></code> 语句时，**<font style="color:rgb(0, 0, 0);">函数执行会暂停</font>**，并把 <code><font style="color:rgb(0, 0, 0);">yield</font></code> 后面的表达式作为当前迭代的值返回；
>
> 下一次调用 <code><font style="color:rgb(0, 0, 0);">next()</font></code> 或继续 <code><font style="color:rgb(0, 0, 0);">for</font></code> 循环时，函数\*\*<font style="color:rgb(0, 0, 0);">从上次暂停的位置继续执行</font>\*\*，直到再次遇到 <code><font style="color:rgb(0, 0, 0);">yield</font></code>。

```python
def countdown(n):
    while n > 0:
        yield n
        n -= 1

generator = countdown(5)
print(next(generator))    # 输出: 5
print(next(generator))    # 输出: 4
print(next(generator))    # 输出: 3
for value in generator:   # 继续从暂停处迭代
    print(value)          # 输出: 2 1

```

## 函数与Lambda

### 参数传递机制

* **<font style="color:rgb(0, 0, 0);">传不可变对象</font>**<font style="color:rgb(0, 0, 0);">：函数内对参数重新赋值时，实际是新建一个对象并让形参指向它，</font>**<font style="color:rgb(0, 0, 0);">不影响外部实参</font>**<font style="color:rgb(0, 0, 0);">。可通过 </font><code><font style="color:rgb(0, 0, 0);">id()</font></code><font style="color:rgb(0, 0, 0);"> 验证：调用前后形参与实参指向同一对象（id 相同），函数内部修改后形参指向新对象（id 改变）。</font>
* **<font style="color:rgb(0, 0, 0);">传可变对象</font>**<font style="color:rgb(0, 0, 0);">：函数内修改参数内容（如 </font><code><font style="color:rgb(0, 0, 0);">append</font></code><font style="color:rgb(0, 0, 0);">），</font>**<font style="color:rgb(0, 0, 0);">外部原始对象同步改变</font>**<font style="color:rgb(0, 0, 0);">，因为传过去的是同一个引用。</font>

### <font style="color:rgb(0, 0, 0);">参数类型</font>

1. **必须参数**

```python
def printme(str):
    print(str)
    return

printme()   
# 报错: TypeError: printme() missing 1 required positional argument: 'str'
```

2. **关键字参数**

```python
def printinfo(name, age):
    print("名字: ", name)
    print("年龄: ", age)
    return

printinfo(age=50, name="runoob")   # 顺序颠倒也能正确匹配
# 输出: 名字:  runoob
#       年龄:  50
```

3. **默认参数**

```python
def printinfo(name, age=35):
    print("名字: ", name)
    print("年龄: ", age)
    return

printinfo(name="runoob")   # 未传 age，使用默认值 35
# 输出: 名字:  runoob
#       年龄:  35
```

4. **不定长参数**

```python
# 单星号：收集多余的位置参数为元组
def printinfo(arg1, *vartuple):
    print("输出: ", arg1)
    print(vartuple)
# -----------------------------------------------------------------

printinfo(70, 60, 50)    # 输出: 70  (60, 50)
printinfo(10)            # 未传时 vartuple 为空元组

# 双星号：收集关键字参数为字典
def printinfo(arg1, **vardict):
    print("输出: ", arg1)
    print(vardict)

printinfo(1, a=2, b=3)   # 输出: 1  {'a': 2, 'b': 3}
# -----------------------------------------------------------------

# 星号单独出现：强制其后参数必须以关键字传入
def f(a, b, *, c):
    return a + b + c

f(1, 2, 3)     # 报错: TypeError
f(1, 2, c=3)   # 正常: 6
# -----------------------------------------------------------------

"""
    / 语法，用于强制指定某些形参只能以位置形式传入。
    结合 *（强制关键字参数），可以精细控制参数传入方式。
    以下示例中:
        a、b 必须按位置传入，
        c、d 既可以是位置参数也可以是关键字参数，
        而 e、f 必须使用关键字形式：
"""
def f(a, b, /, c, d, *, e, f):
    print(a, b, c, d, e, f)

f(10, 20, 30, d=40, e=50, f=60)   # 正确
f(10, b=20, c=30, d=40, e=50, f=60)  # 错误：b 不能使用关键字形式
f(10, 20, 30, 40, 50, f=60)       # 错误：e 必须使用关键字形式

```

### Lambda

lambda 用于创建匿名函数。

通常用于编写简单的单行函数，尤其在需要把函数作为参数传递的场景。

> 语法格式 <code><font style="color:rgb(0, 0, 0);">lambda arguments: expression</font></code>
>
> * <code><font style="color:rgb(0, 0, 0);">lambda</font></code> 是关键字，
> * <code><font style="color:rgb(0, 0, 0);">arguments</font></code> 是参数列表（可为零个或多个，必须在冒号前指定），
> * <code><font style="color:rgb(0, 0, 0);">expression</font></code> 是计算并返回结果的表达式。

```python
x = lambda a, b: a * b      # 双参数
print(x(5, 6))              # 输出: 30
```

### global与nonlocal

* <font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">使用 </font><code><font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">global</font></code><font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);"> 可以在函数中修改全局变量。</font>
* <font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">使用 </font><code><font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">nonlocal</font></code><font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);"> 可以在嵌套函数中修改外部函数的变量。</font>

```python
num = 1
def fun1():
    global num  # 需要使用 global 关键字声明
    num = 123
    print(num)  # 打印123
fun1()          
print(num)      # 打印123
#-----------------------------------------------------------------
def outer():
    num = 10
    def inner():
        nonlocal num   # nonlocal关键字声明
        num = 100
        print(num)     # 打印100
    inner()
    print(num)         # 打印100
outer()
```

## 装饰器

装饰器 用于<font style="color:rgb(0, 0, 0);">在不修改原函数代码的前提下，动态扩展函数或类的功能</font>。

> 装饰器支持叠加使用，其执行顺序有明确规则：**<font style="color:rgb(0, 0, 0);">定义阶段从下到上依次包裹函数，调用阶段从上到下依次执行</font>**。

### 函数装饰器

其本质是一个函数：接收一个函数作为参数，并返回一个新的函数（通常是原函数的增强版本），通过 <code><font style="color:rgb(0, 0, 0);">@装饰器名称</font></code> 语法应用在函数或方法定义之前。

> 这一机制的核心思想可以概括为"**<font style="color:rgb(0, 0, 0);">函数包装函数</font>**"，常见应用场景包括日志记录、性能统计、权限控制和结果缓存。

```python
def decorator_function(original_function):
    def wrapper(*args, **kwargs):
        # 调用前
        print("执行前")
        
        # 使用 *args, **kwargs 可以兼容任意参数函数。
        result = original_function(*args, **kwargs)
        
        # 调用后
        print("执行后")
        return result
    return wrapper

# @ 后的名字必须指向一个真实存在的、接收函数并返回函数的可调用对象。
@decorator_function
def target_function(): # 也可以带参数，wrapper 已经使用 *args, **kwargs 来接收并透传任意参数
    print("原函数执行")
# 上述写法等价于 target_function = decorator_function(target_function)

target_function()
# 输出
# 执行前
# 原函数执行
# 执行后
```

### 函数装饰器工厂

当装饰器本身需要接收参数时，需要采用"三层嵌套"的结构——外层函数接收装饰器参数，中层函数接收原函数，内层 wrapper 执行实际逻辑。这种模式被称为"装饰器工厂"

```python
def repeat(num_times):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for _ in range(num_times):
                func(*args, **kwargs)
        return wrapper
    return decorator

@repeat(3)
def say_hello():
    print("Hello!")

say_hello()
# 输出三行 Hello!
```

> <code><font style="color:rgb(0, 0, 0);">@repeat(3)</font></code> 先调用外层函数 <code><font style="color:rgb(0, 0, 0);">repeat</font></code> 得到真正的装饰器 <code><font style="color:rgb(0, 0, 0);">decorator</font></code><font style="color:rgb(0, 0, 0);">,</font>
>
> 再由<code><font style="color:rgb(0, 0, 0);">decorator</font></code>包装 <code><font style="color:rgb(0, 0, 0);">say_hello</font></code>，从而实现"重复执行 3 次"的定制化行为。

### 类装饰器

类装饰器接收一个类，并返回修改后的类或包装类，适用于增强类方法、控制实例化过程、实现单例模式等场景。

1. **<font style="color:rgb(0, 0, 0);">函数形式的类装饰器</font>**

```python
def log_class(cls):
    class Wrapper:
        def __init__(self, *args, **kwargs):
            self.wrapped = cls(*args, **kwargs)
        def __getattr__(self, name):
            return getattr(self.wrapped, name)
        def display(self):
            print("调用前")
            self.wrapped.display()
            print("调用后")
    return Wrapper

@log_class
class MyClass:
    def display(self):
        print("原方法")

obj = MyClass()
obj.display()
# 输出：调用前 / 原方法 / 调用后
```

> **<font style="color:rgb(0, 0, 0);">函数形式的类装饰器</font>**——通过包装类包裹原类，并借助 <code><font style="color:rgb(0, 0, 0);">__getattr__</font></code> 将未定义的属性访问代理给被包装的实例

2. **类形式的类装饰器**

```python
class SingletonDecorator:
    def __init__(self, cls):
        self.cls = cls
        self.instance = None
    def __call__(self, *args, **kwargs):
        if self.instance is None:
            self.instance = self.cls(*args, **kwargs)
        return self.instance

@SingletonDecorator
class Database:
    def __init__(self):
        print("初始化")

db1 = Database()
db2 = Database()
print(db1 is db2)
# 输出：初始化  True（仅初始化一次，两个引用指向同一实例）
```

> **<font style="color:rgb(0, 0, 0);">类形式的类装饰器</font>**——通过实现 <code><font style="color:rgb(0, 0, 0);">__call__</font></code> 让装饰器类实例本身可被调用，经典应用是单例模式，保证类无论实例化多少次都只返回同一个对象：

### 内置装饰器

* <code><font style="color:rgb(0, 0, 0);">@staticmethod</font></code><font style="color:rgb(0, 0, 0);">：定义静态方法，不依赖实例和类</font>
* <code><font style="color:rgb(0, 0, 0);">@classmethod</font></code><font style="color:rgb(0, 0, 0);">：定义类方法，自动接收类 </font><code><font style="color:rgb(0, 0, 0);">cls</font></code><font style="color:rgb(0, 0, 0);"> 作为第一个参数</font>
* <code><font style="color:rgb(0, 0, 0);">@property</font></code><font style="color:rgb(0, 0, 0);">：将方法变为属性访问，配合 </font><code><font style="color:rgb(0, 0, 0);">@name.setter</font></code><font style="color:rgb(0, 0, 0);"> 实现属性读写控制</font>

```python
class MyClass:
    @staticmethod
    def static_method():
        print("静态方法")

    @classmethod
    def class_method(cls):
        print(cls.__name__)

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        self._name = value
```

## with关键字

### 简单使用

<code><font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">with</font></code><font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);"> 关键字为提供了一种优雅的方式来处理文件操作、数据库连接等需要明确释放资源的场景。</font>

自动调用清理方法，不需要使用<code><font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">try-finally</font></code><font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);"> 块</font>

```python
with open('example.txt', 'r') as file:
    content = file.read()
    print(content)
# 文件已自动关闭
```

> 异常处理机制：
>
> * <code><font style="color:rgb(0, 0, 0);">__enter__()</font></code><font style="color:rgb(0, 0, 0);">：进入上下文时调用，返回值赋给 </font><code><font style="color:rgb(0, 0, 0);">as</font></code><font style="color:rgb(0, 0, 0);"> 后的变量</font>
> * <code><font style="color:rgb(0, 0, 0);">__exit__(exc_type, exc_val, exc_tb)</font></code><font style="color:rgb(0, 0, 0);">：退出上下文时调用，处理清理工作，接收异常类型、异常值和异常追踪信息三个参数。 返回 </font><code><font style="color:rgb(0, 0, 0);">True</font></code><font style="color:rgb(0, 0, 0);">，表示异常已被处理、不会继续向外传播；返回 </font><code><font style="color:rgb(0, 0, 0);">False</font></code><font style="color:rgb(0, 0, 0);"> 或 </font><code><font style="color:rgb(0, 0, 0);">None</font></code><font style="color:rgb(0, 0, 0);">，异常会继续传播。  </font>

### 自定义上下位管理器

**方法一：**

```python
class Timer:
    def __enter__(self):
        import time
        self.start = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        import time
        self.end = time.time()
        print(f"耗时: {self.end - self.start:.2f}秒")
        return False   # 返回 False，异常继续向外传播

# 使用示例
with Timer() as t:
    sum(range(1000000))   # 执行耗时操作
```

**方法二：**

> <code><font style="color:rgb(0, 0, 0);">@contextmanager</font></code> 装饰器配合 <code><font style="color:rgb(0, 0, 0);">yield</font></code> 语句，将生成器函数变成上下文管理器，<code><font style="color:rgb(0, 0, 0);">yield</font></code> 之前的代码在进入时执行，<code><font style="color:rgb(0, 0, 0);">yield</font></code> 之后的代码在退出时执行

```python
from contextlib import contextmanager

@contextmanager
def tag(name):
    print(f"<{name}>")
    yield
    print(f"</{name}>")

# 使用示例
with tag("h1"):
    print("这是一个标题")
# 输出：
# <h1>
# 这是一个标题
# </h1>
```

## 异常

### try...except...else...finally

```python
try:
    # 有可能抛出异常的代码
except ZeroDivisionError:
    # 捕获 ZeroDivisionError 异常时执行
except:
    # 捕获所有其他异常
else:
    # try代码块**没有抛出任何异常**时才执行
finally:
    # 无论是否抛出异常，一定会执行
```

### raise主动抛出异常

```python
# 形式1：抛出异常类，不带消息
raise ValueError

# 形式2：抛出异常实例，带错误信息（最常用）
raise ValueError("数值不能小于0")
```

### 自定义异常

<font style="color:rgb(0, 0, 0);">通过继承 Exception 类即可创建自定义异常</font>，可直接继承或间接继承

```python
# 此处覆盖了 Exception 默认的 __init__() 方法
# 并通过 __str__() 定义了异常被打印时的表现。 
class MyError(Exception):
    def __init__(self, value):
        self.value = value
    def __str__(self):
        return repr(self.value)

try:
    raise MyError(2 * 2)
except MyError as e:
    print('My exception occurred, value:', e.value)

```

## 面向对象语法

### 类属性和方法

***概念：***

* 类(class)与实例对象
* 属性
  * 类属性
  * 实例属性
    * 公有属性
    * 伪私有属性（**\_单下划线 **仅约定、**\_\_双下划线** 约定+名称改写）
* 方法
  * 构造方法：`__init__`
  * 实例方法（self）
  * 伪私有方法：与伪私有属性一致
  * 类方法：`@classmethod`
  * 静态方法：`@staticmethod`
  * 属性相关方法
    * getter 方法：`@property`
    * setter 方法：`@xxx.setter`
  * 魔术方法：`__str__`、`__repr__`等

```python
class Person:
    # 类属性：属于类本身，所有实例共享
    species = "人类"

    # __init__ 构造方法：创建实例时自动调用
    def __init__(self, name, age):
        # 公有属性
        self.name = name
        # 单下划线：约定伪私有，外部理论可访问，但不建议直接用
        self._age = age
        # 双下划线：名称改写的伪私有(改写为_Person__id)
        # 外部不能直接访问 self.__id
        self.__id = 10001

    # 实例方法，第一个参数 self，代表当前实例对象
    def introduce(self):
        return f"我是{self.name}，今年{self._age}岁"

    # @property 只读属性装饰器，用来读取双下划线私有变量
    @property
    def id(self):
        return self.__id

    # @xxx.setter 修改双下划线私有变量的值
    @id.setter
    def id(self,value):
        self.__id = value

    # @classmethod 类方法，参数 cls 代表类本身
    @classmethod
    def get_species(cls):
        return cls.species

    # @staticmethod 静态方法，不需要 self / cls，独立工具函数
    @staticmethod
    def is_adult(age):
        return age >= 18

    # 魔术方法 __str__：print(对象) 时调用，面向用户友好字符串
    def __str__(self):
        return f"Person(name={self.name}, age={self._age})"

    # 魔术方法 __repr__：解释器直接输出对象时调用，开发者字符串
    def __repr__(self):
        return self.__str__()


if __name__ == "__main__":
    # 类(class)与实例对象：根据类创建实例 p1
    p1 = Person("张三", 22)

    # 访问实例方法
    print(p1.introduce())

    # 访问类属性
    print(Person.species)
    print(p1.species)

    # 访问只读 property（读取私有__id）
    print(p1.id)

    # 调用类方法
    print(Person.get_species())

    # 调用静态方法
    print(Person.is_adult(22))

    # __str__ 演示
    print(p1)
    # __repr__ 演示
    print(repr(p1))

```

### 继承

**单继承：**

```python
# 父类
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        print("动物发出声音")

# 单继承
class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name)  # super调用父类构造
        self.breed = breed

    # 方法重写
    def speak(self):
        super().speak() # 调用父类同名方法
        print(f"{self.name} 汪汪叫")
```

**多继承：**

```python
# 父类1
class Father:
    def __init__(self, name):
        self.name = name
        print("Father构造执行")

# 父类2
class Mother:
    def __init__(self, age):
        self.age = age
        print("Mother构造执行")

# 多继承子类
class Child(Father, Mother):
    def __init__(self, name, age):
        super().__init__(name)   # super默认只会调用第一个父类的__init__
        Mother.__init__(self, age) # 手动调用第二个父类构造，必须传self
```

### 多态

```python
# 父类
class Animal:
    def speak(self):
        pass

# 子类1
class Dog(Animal):
    def speak(self):
        print("汪汪汪")

# 子类2
class Cat(Animal):
    def speak(self):
        print("喵喵喵")

# 多态函数：接收Animal类型对象，调用speak
def make_sound(animal: Animal):
    animal.speak()


dog = Dog()
cat = Cat()

make_sound(dog)
make_sound(cat)

```

> 鸭子类型：
>
> Python 并不强制参数类型，只要对象具备 <code><font style="color:rgb(0, 0, 0);">speak()</font></code> 方法即可调用，甚至无需继承任何类 。

## 模块

**作用：**

* **<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">代码复用</font>**<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">：将常用的功能封装到模块中，可以在多个程序中重复使用。</font>
* **<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">命名空间管理</font>**<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">：模块可以避免命名冲突，不同模块中的同名函数或变量不会互相干扰。</font>
* **<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">代码组织</font>**<font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">：将代码按功能划分到不同的模块中，使程序结构更清晰。</font>

### <font style="color:rgb(51, 51, 51);background-color:rgb(250, 250, 248);">\_\_name__属性</font>

每个模块都有 <code><font style="color:rgb(0, 0, 0);">__name__</font></code> 属性，其值取决于模块的运行方式：**<font style="color:rgb(0, 0, 0);">被直接运行时值为 </font>**<code>**<font style="color:rgb(0, 0, 0);">__main__</font>**</code>**<font style="color:rgb(0, 0, 0);">，被导入时值为模块名</font>**。

```python
# using_name.py
if __name__ == '__main__':
    print('程序自身在运行')
else:
    print('我来自另一模块')

# 直接运行: python using_name.py → 程序自身在运行
# 交互式导入: import using_name → 我来自另一模块
```

### 包

包通过 <code><font style="color:rgb(0, 0, 0);">__init__.py</font></code> 文件标识，采用点模块名称组织分层结构。

目录只有包含 <code><font style="color:rgb(0, 0, 0);">__init__.py</font></code>

```plain
sound/                          # 顶层包
      __init__.py               # 初始化 sound 包
      formats/                  # 文件格式转换子包
              __init__.py
              wavread.py
              wavwrite.py
              ...
      effects/                  # 声音效果子包
              __init__.py
              echo.py
              surround.py
              reverse.py
              ...
```

包还支持 <code><font style="color:rgb(0, 0, 0);">__all__</font></code> 列表变量，用于精确指定 <code><font style="color:rgb(0, 0, 0);">from package import *</font></code> 时导入的内容。例如在`__init__.py`中这样写：

```python
# sounds/effects/__init__.py
__all__ = ["echo", "surround", "reverse"]
```

> 若未定义 <code><font style="color:rgb(0, 0, 0);">__all__</font></code>，<code><font style="color:rgb(0, 0, 0);">from sound.effects import *</font></code> 将不会导入任何子模块，仅导入 <code><font style="color:rgb(0, 0, 0);">__init__.py</font></code> 中定义的内容。
