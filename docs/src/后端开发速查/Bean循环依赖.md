
## 一、快速查询：循环依赖场景判断

### 1.1 一句话结论

**Spring默认只能解决：singleton + setter注入 的循环依赖。**

其他情况都会报错。

### 1.2 能否解决一览

| 注入方式 | singleton（单例） | prototype（多例） |
|----------|-----------|-----------|
| Setter注入（@Autowired/@Resource） | 能解决 | 不能解决 |
| 构造器注入 | 不能解决 | 不能解决 |

### 1.3 什么是循环依赖

A对象依赖B对象，B对象又依赖A对象，形成闭环：

```java
@Component
public class Husband {
    private String name;
    private Wife wife;  // 依赖Wife
}

@Component
public class Wife {
    private String name;
    private Husband husband;  // 依赖Husband
}
```

---

## 二、实战建议

### 2.1 避免循环依赖的设计原则

- 优先使用Setter注入而非构造器注入
- 合理拆分职责，避免双向依赖
- 如果A依赖B，B也依赖A，考虑是否应该合并为一个Bean

### 2.2 报错BeanCurrentlyInCreationException时的排查步骤

1. 检查是否存在循环依赖
2. 确认是否都是singleton作用域
3. 确认是否使用了构造器注入

### 2.3 混合作用域说明

| 依赖关系 | 是否有问题 |
|----------|-----------|
| singleton（单例）→ prototype（多例） | 没问题 |
| prototype（多例）→ singleton（单例） | 没问题 |
| prototype（多例）↔ prototype（多例） | 有问题 |

### 2.4 toString()的坑

循环依赖时重写toString()要小心：

```java
// 错误：会递归导致栈溢出
@Override
public String toString() {
    return "Husband{name='" + name + "', wife=" + wife + "}";
}

// 正确：只输出需要的属性
@Override
public String toString() {
    return "Husband{name='" + name + "', wife=" + wife.getName() + "}";
}
```

---

## 三、各种场景测试

### 3.1 singleton（单例） + setter注入（能解决）

**Spring Boot方式：**

```java
@Component
public class Husband {
    private String name;
    @Autowired
    private Wife wife;
}

@Component
public class Wife {
    private String name;
    @Autowired
    private Husband husband;
}
```

**结果：** 正常运行，Spring通过三级缓存解决。

**传统XML配置：**

```xml
<bean id="husbandBean" class="com.example.Husband" scope="singleton">
    <property name="name" value="张三"/>
    <property name="wife" ref="wifeBean"/>
</bean>
<bean id="wifeBean" class="com.example.Wife" scope="singleton">
    <property name="name" value="小花"/>
    <property name="husband" ref="husbandBean"/>
</bean>
```

### 3.2 prototype（多例） + setter注入（不能解决）

**配置：**

```xml
<bean id="husbandBean" class="com.example.Husband" scope="prototype">
    <property name="name" value="张三"/>
    <property name="wife" ref="wifeBean"/>
</bean>
<bean id="wifeBean" class="com.example.Wife" scope="prototype">
    <property name="name" value="小花"/>
    <property name="husband" ref="husbandBean"/>
</bean>
```

**结果：** 抛出异常

```
Caused by: org.springframework.beans.factory.BeanCurrentlyInCreationException:
Error creating bean with name 'husbandBean': Requested bean is currently in creation:
Is there an unresolvable circular reference?
```

**原因：** 多例模式下，Spring不会缓存Bean实例，无法利用三级缓存。

### 3.3 singleton（单例） + 构造器注入（不能解决）

```java
public class Husband {
    private String name;
    private Wife wife;

    public Husband(String name, Wife wife) {
        this.name = name;
        this.wife = wife;  // 构造器注入
    }
}
```

**结果：** 抛出异常

```
Caused by: org.springframework.beans.factory.BeanCurrentlyInCreationException:
Error creating bean with name 'hBean': Requested bean is currently in creation:
Is there an unresolvable circular reference?
```

**原因：** 构造器注入要求实例化和属性赋值同时完成，无法分离。

---

## 四、三级缓存机制（原理）

> 以下为原理性内容，理解三级缓存有助于解决复杂问题。

### 4.1 三级缓存一览

| 缓存级别 | 名称 | 存储内容 | 作用 | 详情 |
|----------|------|----------|------|------|
| 第一级 | singletonObjects | 完整的、成熟的Bean | 对外提供最终可用的Bean（成品仓库） | 存放**实例化、属性填充、初始化全部完成**的**完整成品 Bean**，可对外提供使用。 |
| 第二级 | earlySingletonObjects | 早期的Bean引用 | 避免重复创建早期引用（半成品暂存区） | 存放**已实例化、已填充属性，未执行初始化方法**的**半成品 Bean / 代理 Bean**。 |
| 第三级 | singletonFactories | ObjectFactory对象工厂 | 核心：解决循环依赖，并处理AOP代理（生产线） | 存放**仅构造器实例化、未填充属性、未初始化**的 Bean **ObjectFactory 工厂引用**。 |

### 4.2 获取Bean的查找顺序

当调用getBean()时，Spring按以下顺序查找：

```
一级缓存 → 二级缓存 → 三级缓存 → 创建新实例
```

### 4.3 解决流程图解

以ClassA依赖ClassB，ClassB又依赖ClassA为例：

**第一步：开始创建ClassA**

1. 调用getBean("classA")，A不在缓存中，开始创建
2. 实例化：通过构造函数new ClassA()创建原始对象（此时classB属性为null）
3. **提前曝光**：将ObjectFactory放入第三级缓存singletonFactories

**第二步：填充ClassA的属性**

1. 执行populateBean()，发现依赖classB
2. 调用getBean("classB")

**第三步：开始创建ClassB**

1. 实例化B，创建原始对象
2. 将B的ObjectFactory放入第三级缓存

**第四步：填充ClassB的属性（关键）**

1. 执行populateBean()，发现依赖classA
2. 再次调用getBean("classA")
3. 查找顺序：一级没有 → 二级没有 → **三级找到了！**
4. 调用ObjectFactory.getObject()获取A的早期引用
5. 将早期引用放入二级缓存，从三级缓存移除
6. 将A的早期引用注入到ClassB的classA属性中

**第五步：完成创建**

1. ClassB完成属性填充和初始化，放入一级缓存
2. getBean("classB")返回，注入到ClassA的classB属性
3. ClassA完成初始化，放入一级缓存

### 4.4 关键源码

```java
// DefaultSingletonBeanRegistry.java
protected Object getSingleton(String beanName, boolean allowEarlyReference) {
    // 一级缓存：成品Bean
    Object singletonObject = this.singletonObjects.get(beanName);
    if (singletonObject == null && isSingletonCurrentlyInCreation(beanName)) {
        // 二级缓存：早期引用
        synchronized (this.singletonObjects) {
            singletonObject = this.earlySingletonObjects.get(beanName);
            if (singletonObject == null && allowEarlyReference) {
                // 三级缓存：ObjectFactory
                ObjectFactory<?> singletonFactory = this.singletonFactories.get(beanName);
                if (singletonFactory != null) {
                    singletonObject = singletonFactory.getObject();
                    this.earlySingletonObjects.put(beanName, singletonObject);
                    this.singletonFactories.remove(beanName);
                }
            }
        }
    }
    return singletonObject;
}
```

---

## 五、为什么需要三级缓存（原理）

### 5.1 两级缓存的问题

假设只用一级和二级缓存：

1. 实例化A后，将原始对象A放入二级缓存
2. B获取A的早期引用，注入到B中
3. A完成初始化，放入一级的是**代理对象$ProxyA**
4. B持有的是**原始对象A**

**后果：** B调用A的方法时，完全不会经过AOP代理增强，事务、日志全部失效。

### 5.2 三级缓存的优势

第三级缓存的ObjectFactory是"智能决策器"，可以延迟判断是否需要代理：

- 不需要代理 → 返回原始对象
- 需要代理 → 提前返回代理对象

这样B注入的就是最终的代理对象，保证了一致性。

### 5.3 一句话总结

**三级缓存的核心目的：在解决循环依赖的同时，无缝兼容Spring AOP的代理机制。**

---

## 六、面试要点

### 6.1 核心口诀

```
循环依赖解决：singleton（单例） + setter注入 → 三级缓存
循环依赖无法解决：prototype（多例） + 构造器注入
```

### 6.2 常见面试题

**Q1：Spring是如何解决循环依赖的？**

通过三级缓存机制解决。实例化Bean后提前曝光到三级缓存，属性填充时如果发现依赖的Bean正在创建中，从缓存获取早期引用注入，打破循环。三级缓存分别是：singletonObjects（成品）、earlySingletonObjects（半成品）、singletonFactories（对象工厂）。

**Q2：为什么需要三级缓存，两级不行吗？**

两级缓存无法兼容AOP代理。如果只用二级缓存，B持有的是原始对象A，而容器最终管理的是代理对象$ProxyA，导致B调用A时AOP增强失效。三级缓存通过ObjectFactory延迟判断，可以在早期就返回正确的代理对象。

**Q3：哪些循环依赖Spring无法解决？**

- 构造器注入的循环依赖无法解决
- 多例作用域（prototype）的循环依赖无法解决
- 多例Bean之间的循环依赖无法解决

**Q4：@Autowired和@Resource哪个更容易产生循环依赖？**

两者都是Setter注入，本质上没有区别。如果用构造器注入，两者都会产生循环依赖问题。避免循环依赖的关键是设计好依赖关系，而非选择哪个注解。
