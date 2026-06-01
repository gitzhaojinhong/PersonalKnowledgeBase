
# Spring Bean 生命周期完全指南

---

## 第一部分：生命周期全景

---

### 1. 完整生命周期流程

> **关键区分：** Spring 的生命周期分为**容器级**和 **Bean 级**两个阶段。容器级操作在所有 Bean 实例化**之前**执行，Bean 级操作在 Bean 实例创建**之后**执行。

#### 1.1 完整流程图

```
═══════════════════════════════════════════════════════════════
  容器级（Bean 实例化之前）
═══════════════════════════════════════════════════════════════

  ApplicationContextInitializer.initialize()        ← 最早期，容器刷新之前
       ↓
  BeanDefinitionRegistryPostProcessor
    .postProcessBeanDefinitionRegistry()            ← 注册/修改/移除 BeanDefinition
    .postProcessBeanFactory()
       ↓
  BeanFactoryPostProcessor
    .postProcessBeanFactory()                       ← 修改 BeanDefinition 属性值

═══════════════════════════════════════════════════════════════
  Bean 级（每个 Bean 实例都会经历）
═══════════════════════════════════════════════════════════════

  第1步前：InstantiationAwareBeanPostProcessor
    .postProcessBeforeInstantiation()              ← 可短路 Bean 创建，直接返回代理
       ↓
  第1步：实例化（构造方法）
       ↓
  第1步后：InstantiationAwareBeanPostProcessor
    .postProcessAfterInstantiation()               ← 可跳过属性填充
    .postProcessProperties()                       ← @Autowired 实际注入点
       ↓
  第2步：属性填充（根据 postProcessProperties 结果注入）
       ↓
  第3步：Aware 接口回调
    ├── BeanNameAware.setBeanName()
    ├── BeanFactoryAware.setBeanFactory()
    └── ApplicationContextAware.setApplicationContext()
       ↓
  第4步：BeanPostProcessor.postProcessBeforeInitialization()
       ↓
  第5步：初始化方法（按顺序执行）
    ├── @PostConstruct 注解方法
    ├── InitializingBean.afterPropertiesSet()
    └── @Bean(initMethod = "xxx")
       ↓
  第6步：BeanPostProcessor.postProcessAfterInitialization()
       ↓
  第7步：Bean 就绪，放入单例池

═══════════════════════════════════════════════════════════════
  所有单例 Bean 实例化完成后
═══════════════════════════════════════════════════════════════

  SmartInitializingSingleton.afterSingletonsInstantiated()  ← 所有单例就绪后

═══════════════════════════════════════════════════════════════
  应用运行中
═══════════════════════════════════════════════════════════════

  ApplicationListener.onApplicationEvent()           ← 事件驱动（运行时）

═══════════════════════════════════════════════════════════════
  销毁阶段（容器关闭时）
═══════════════════════════════════════════════════════════════

  第8步：@PreDestroy 注解方法
  第9步：DisposableBean.destroy()
  第10步：@Bean(destroyMethod = "xxx")
```

#### 1.2 容器级 vs Bean 级对比

| 维度 | 容器级 | Bean 级 |
|------|--------|---------|
| **执行时机** | Bean 实例化**之前** | Bean 实例化**之后** |
| **作用对象** | `BeanDefinition`（元数据） | `Bean` 实例本身 |
| **典型接口** | `BeanDefinitionRegistryPostProcessor`、`BeanFactoryPostProcessor` | `BeanPostProcessor`、`InitializingBean` |
| **执行次数** | 每个实现类只执行 **1 次** | 每个 Bean 实例都执行 |
| **代表实现** | `ConfigurationClassPostProcessor`、`PropertyPlaceholderConfigurer` | `InitDestroyAnnotationBeanPostProcessor`（@PostConstruct）、`AbstractAutoProxyCreator`（AOP） |

#### 1.3 初始化方法执行顺序（固定）

```
1. @PostConstruct 注解方法
2. InitializingBean.afterPropertiesSet()
3. @Bean(initMethod = "xxx")
```

#### 1.4 销毁方法执行顺序（固定）

```
1. @PreDestroy 注解方法
2. DisposableBean.destroy()
3. @Bean(destroyMethod = "xxx")
```

---

### 2. 完整生命周期演示

#### 2.1 BeanPostProcessor

BeanPostProcessor需要单独写一个类，它会拦截所有Bean的初始化前后：

```java
@Component
public class MyBeanPostProcessor implements BeanPostProcessor {
    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        System.out.println("【第4步】BeanPostProcessor.beforeInitialization：" + beanName);
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        System.out.println("【第6步】BeanPostProcessor.afterInitialization：" + beanName);
        return bean;
    }
}
```

#### 2.2 实现所有回调接口的Bean

```java
@Component
public class LifeCycleBean implements
        BeanNameAware,
        BeanFactoryAware,
        ApplicationContextAware,
        InitializingBean,
        DisposableBean {

    public LifeCycleBean() {
        System.out.println("【第1步】实例化：构造器执行");
    }

    @Override
    public void setBeanName(String name) {
        System.out.println("【第3步-A】BeanNameAware：" + name);
    }

    @Override
    public void setBeanFactory(BeanFactory beanFactory) throws BeansException {
        System.out.println("【第3步-B】BeanFactoryAware");
    }

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
        System.out.println("【第3步-C】ApplicationContextAware");
    }

    @PostConstruct
    public void postConstruct() {
        System.out.println("【第5步-方式1】@PostConstruct 初始化");
    }

    @Override
    public void afterPropertiesSet() throws Exception {
        System.out.println("【第5步-方式2】InitializingBean.afterPropertiesSet");
    }

    public void customInit() {
        System.out.println("【第5步-方式3】自定义 init-method");
    }

    @PreDestroy
    public void preDestroy() {
        System.out.println("【第8步】@PreDestroy 销毁前");
    }

    @Override
    public void destroy() throws Exception {
        System.out.println("【第9步】DisposableBean.destroy");
    }

    public void customDestroy() {
        System.out.println("【第10步】自定义 destroy-method");
    }
}
```

#### 2.3 运行结果

```
【第1步】实例化：构造器执行
【第2步】属性填充（通过@Autowired注入）
【第3步-A】BeanNameAware：lifeCycleBean
【第3步-B】BeanFactoryAware
【第3步-C】ApplicationContextAware
【第4步】BeanPostProcessor.beforeInitialization：lifeCycleBean
【第5步-方式1】@PostConstruct 初始化
【第5步-方式2】InitializingBean.afterPropertiesSet
【第5步-方式3】自定义 init-method
【第6步】BeanPostProcessor.afterInitialization：lifeCycleBean
【第7步】Bean就绪
--- 容器关闭 ---
【第8步】@PreDestroy 销毁前
【第9步】DisposableBean.destroy
【第10步】自定义 destroy-method
```

---

## 第二部分：Bean 级生命周期

> 按照 Bean 创建 → 运行 → 销毁的生命周期顺序组织。

---

### 3. 创建阶段

#### 3.1 第1步：实例化

- **做什么：** 调用构造器，创建对象
- **如何实现：** 定义Bean类，Spring通过构造器反射创建

```java
@Component
public class UserService {
    public UserService() {  // 第1步在这里执行
        System.out.println("对象被创建了");
    }
}
```

#### 3.2 实例化拦截：InstantiationAwareBeanPostProcessor

在"第1步实例化"和"第2步属性填充"之间，Spring 通过 `InstantiationAwareBeanPostProcessor`（`BeanPostProcessor` 的子接口）提供了更细粒度的钩子：

```
postProcessBeforeInstantiation()    ← 实例化之前调用，可返回代理对象短路整个 Bean 创建
       ↓
  构造方法实例化（如果上面返回 null 才执行）
       ↓
postProcessAfterInstantiation()     ← 实例化之后调用，返回 false 可跳过属性填充
       ↓
postProcessProperties()             ← 属性填充前调用，@Autowired 实际注入发生在这里
       ↓
  属性填充（根据上面的处理结果注入依赖）
```

**通用示例：**

```java
@Component
public class MyInstantiationProcessor implements InstantiationAwareBeanPostProcessor {

    @Override
    public Object postProcessBeforeInstantiation(Class<?> beanClass, String beanName) {
        // 返回非 null 会短路整个 Bean 创建流程（跳过构造器、属性填充、初始化）
        if (beanClass == MyService.class) {
            return Proxy.newProxyInstance(beanClass.getClassLoader(),
                    beanClass.getInterfaces(), (proxy, method, args) -> null);
        }
        return null;  // 返回 null，继续正常的 Bean 创建流程
    }

    @Override
    public boolean postProcessAfterInstantiation(Object bean, String beanName) {
        return true;  // 返回 true 继续属性填充，返回 false 跳过属性填充
    }

    @Override
    public PropertyValues postProcessProperties(PropertyValues pvs, Object bean, String beanName) {
        // @Autowired 注入就是在这里完成的
        // 可以在这里修改或添加要注入的属性值
        return pvs;
    }
}
```

**使用时机：** 需要在实例化阶段（而非初始化阶段）拦截 Bean 创建，或需要自定义属性注入逻辑时。日常开发很少直接使用，框架内部用它来实现 @Autowired、@Value 等注入。

#### 3.3 第2步：属性填充（依赖注入）

- **做什么：** 注入依赖（@Autowired、@Value、@Resource等）

```java
@Component
public class OrderService {
    @Autowired  // 第2步：注入UserService
    private UserService userService;

    @Value("${timeout:30}")  // 第2步：注入配置值
    private int timeout;
}
```

#### 3.4 第3步：Aware接口回调

- **做什么：** 让Bean获取Spring容器内部信息
- **常用接口：** BeanNameAware、BeanFactoryAware、ApplicationContextAware

```java
@Component
public class AwareBean implements BeanNameAware, ApplicationContextAware {

    private String beanName;
    private ApplicationContext ctx;

    @Override
    public void setBeanName(String name) {
        this.beanName = name;
    }

    @Override
    public void setApplicationContext(ApplicationContext context) {
        this.ctx = context;
    }
}
```

#### 3.5 第4步：BeanPostProcessor前置处理

- **做什么：** 初始化之前的统一拦截
- **常见应用：** 日志记录、校验、属性修改（@Autowired 注入在第2步属性填充阶段已完成，不在此阶段）

```java
@Component
public class MyBeanPostProcessor implements BeanPostProcessor {
    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        return bean;  // 可以返回包装/代理对象替换原对象（AOP 代理在 after 阶段生成，见 3.7）
    }
}
```

#### 3.6 第5步：初始化方法

三种方式，执行顺序固定：

**方式一：@PostConstruct（推荐首选）**

```java
@Component
public class UserService {
    @PostConstruct
    public void init() {
        System.out.println("初始化逻辑");
    }
}
```

**方式二：InitializingBean接口**

```java
@Component
public class DataSourceConfig implements InitializingBean {
    @Override
    public void afterPropertiesSet() throws Exception {
        System.out.println("属性填充完成后执行");
    }
}
```

**方式三：@Bean指定（常用于第三方类）**

```java
@Configuration
public class BeanConfig {
    @Bean(initMethod = "customInit")
    public ThirdPartyService thirdPartyService() {
        return new ThirdPartyService();
    }
}
```

#### 3.7 第6步：BeanPostProcessor后置处理

- **做什么：** 初始化之后的统一拦截
- **常见应用：** AOP代理对象生成（Spring AOP在此生成代理）

#### 3.8 第7步：Bean就绪

- **做什么：** 放入单例池，对外提供服务
- **说明：** 此时Bean已完全初始化，可正常注入到其他Bean使用

#### 3.9 源码中的生命周期流程（AbstractAutowireCapableBeanFactory）

以上流程在 Spring 源码中由 `AbstractAutowireCapableBeanFactory` 驱动，关键方法调用链：

```
createBean(beanName, mbd, args)
  │
  ├── resolveBeforeInstantiation(beanName, mbd)
  │     └── applyBeanPostProcessorsBeforeInstantiation()   ← IABPP.postProcessBeforeInstantiation()
  │     └── applyBeanPostProcessorsAfterInitialization()   ← 如果上面返回非 null
  │
  ├── doCreateBean(beanName, mbd, args)
  │     ├── createBeanInstance()                            ← 第1步：实例化（构造器）
  │     ├── addSingletonFactory(beanName, () -> getEarlyBeanReference())  ← 放入三级缓存
  │     ├── populateBean(beanName, mbd, instanceWrapper)    ← 第2步：属性填充
  │     │     └── IABPP.postProcessProperties()             ← @Autowired 实际注入点
  │     └── initializeBean(beanName, exposedObject, mbd)    ← 第3-7步
  │           ├── invokeAwareMethods()                      ← 第3步：Aware 回调
  │           ├── applyBeanPostProcessorsBeforeInitialization()  ← 第4步：BPP.before
  │           │     └── 触发 @PostConstruct (InitDestroyAnnotationBeanPostProcessor)
  │           ├── invokeInitMethods()                       ← 第5步：afterPropertiesSet / initMethod
  │           └── applyBeanPostProcessorsAfterInitialization()   ← 第6步：BPP.after
  │                 └── AOP 代理在此生成 (AbstractAutoProxyCreator)
  │
  └── addSingleton(beanName, singletonObject)               ← 第7步：放入一级缓存
```

---

### 4. 创建阶段进阶

#### 4.1 循环依赖与三级缓存

##### 4.1.1 什么是循环依赖

当 Bean A 依赖 Bean B，同时 Bean B 又依赖 Bean A 时，就形成了循环依赖：

```java
@Component
public class ServiceA {
    @Autowired
    private ServiceB serviceB;  // A 依赖 B
}

@Component
public class ServiceB {
    @Autowired
    private ServiceA serviceA;  // B 依赖 A
}
```

##### 4.1.2 三级缓存结构

Spring 通过 `DefaultSingletonBeanRegistry` 中的三级缓存解决 singleton 作用域的循环依赖：

```
一级缓存：singletonObjects      → 完全初始化完成的 Bean（最终态）
二级缓存：earlySingletonObjects  → 提前暴露的 Bean 引用（半成品，已实例化但未初始化）
三级缓存：singletonFactories    → ObjectFactory，可生成早期引用（延迟代理生成）
```

| 缓存 | 类型 | 存储内容 | 作用 |
|------|------|----------|------|
| `singletonObjects` | `Map<String, Object>` | 完全初始化的 Bean | 最终态，供 getBean() 使用 |
| `earlySingletonObjects` | `Map<String, Object>` | 早期引用（可能已被代理） | 解决循环依赖时复用 |
| `singletonFactories` | `Map<String, ObjectFactory<?>>` | ObjectFactory | 延迟生成早期引用（支持 AOP 代理） |

**源码结构（`DefaultSingletonBeanRegistry`）：**

```java
// org.springframework.beans.factory.support.DefaultSingletonBeanRegistry
public class DefaultSingletonBeanRegistry implements SingletonBeanRegistry {

    // 三级缓存字段
    private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);      // 一级
    private final Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>(16);     // 三级
    private final Map<String, Object> earlySingletonObjects = new ConcurrentHashMap<>(16);  // 二级

    // 关键方法
    protected void addSingleton(String beanName, Object singletonObject);           // 放入一级缓存
    protected void addSingletonFactory(String beanName, ObjectFactory<?> factory);  // 放入三级缓存
    public Object getSingleton(String beanName);                                     // 从一级缓存获取
    public Object getSingleton(String beanName, ObjectFactory<?> singletonFactory); // 三级缓存查询链
    protected void removeSingleton(String beanName);                                 // 移除
}
```

**`getSingleton(name, ObjectFactory)` 的查询链：**

```
1. 从一级缓存 singletonObjects 获取
   ├─ 命中 → 返回
   └─ 未命中 ↓
2. 从二级缓存 earlySingletonObjects 获取
   ├─ 命中 → 返回
   └─ 未命中 ↓
3. 从三级缓存 singletonFactories 获取 ObjectFactory
   ├─ 命中 → 调用 getObject() → 结果移入二级缓存，删除三级缓存 → 返回
   └─ 未命中 → 返回 null（需要创建 Bean）
```

##### 4.1.3 解决循环依赖的流程（A→B→A）

```
1. 创建 A
   ├─ 实例化 A（调用构造器）
   ├─ 将 A 的 ObjectFactory 放入三级缓存     ← 关键：提前暴露
   └─ 开始属性填充 A，发现需要 B

2. 创建 B
   ├─ 实例化 B（调用构造器）
   ├─ 将 B 的 ObjectFactory 放入三级缓存
   ├─ 开始属性填充 B，发现需要 A
   └─ 从三级缓存获取 A 的 ObjectFactory，调用 getEarlyBeanReference()
      ├─ 得到 A 的早期引用（可能是代理对象）
      ├─ 将早期引用移入二级缓存，删除三级缓存
      └─ B 完成属性填充 → 初始化 → 放入一级缓存

3. 回到 A
   ├─ A 拿到已完成的 B，完成属性填充
   ├─ A 初始化
   ├─ 将 A 从二级/三级缓存移入一级缓存
   └─ A 创建完成
```

##### 4.1.4 为什么需要三级而不是两级？

三级缓存的 `ObjectFactory` 的作用是**延迟代理生成**。如果 A 需要被 AOP 代理，那么在实例化阶段代理对象还不存在。通过 `ObjectFactory.getObject()`（内部调用 `getEarlyBeanReference()`），Spring 可以在需要时才生成代理，而不是在实例化时就强制生成。

如果没有 AOP 代理，两级缓存就够了。三级缓存是为了在不破坏 Spring AOP 代理机制的前提下解决循环依赖。

##### 4.1.5 限制条件

| 情况 | 是否支持 | 原因 |
|------|----------|------|
| singleton + setter/field 注入 | 支持 | 对象先创建，再注入依赖 |
| singleton + 构造器注入 | **不支持** | 构造器注入必须在实例化时就拿到依赖，无法提前暴露 |
| prototype 作用域 | **不支持** | prototype 不经过缓存 |

> **注意：** Spring 官方文档指出循环依赖通常是设计问题，推荐通过重构代码、使用 `@Lazy` 延迟注入等方式避免。

##### 4.1.6 使用时机

**什么时候需要了解？** 当遇到 `BeanCurrentlyInCreationException` 异常时，说明存在 Spring 无法自动解决的循环依赖。

**解决方案：**
- 对构造器注入的循环依赖：改用 setter/field 注入，或使用 `@Lazy` 注解
- 对 prototype 作用域的循环依赖：改用 singleton 作用域，或重构代码消除循环
- 使用 `@Lazy` 注解注入一个延迟代理，打破循环

```java
@Component
public class ServiceA {
    @Autowired
    @Lazy  // 注入一个代理对象，真正使用时才去获取 Bean
    private ServiceB serviceB;
}
```

#### 4.2 FactoryBean

##### 4.2.1 是什么

`FactoryBean` 是 Spring 提供的**工厂模式**扩展点，允许自定义 Bean 的创建逻辑。它与普通 Bean 的生命周期不同：

- `FactoryBean` **自身**：走正常的 Bean 生命周期（实例化→属性填充→初始化）
- `getObject()` **返回的对象**：由 FactoryBean 自行控制创建，不走容器的属性填充和初始化

##### 4.2.2 接口定义

```java
public interface FactoryBean<T> {
    T getObject() throws Exception;       // 返回产品对象
    Class<?> getObjectType();              // 产品类型
    default boolean isSingleton() { return true; }  // 是否单例
}
```

##### 4.2.3 获取方式

```java
// getBean("name")     → 返回 getObject() 的产品对象
// getBean("&name")    → 返回 FactoryBean 自身

@Component("myBean")
public class MyFactoryBean implements FactoryBean<UserService> {
    @Override
    public UserService getObject() {
        // 自定义创建逻辑，不走容器的属性填充和初始化
        return new UserService();
    }

    @Override
    public Class<?> getObjectType() {
        return UserService.class;
    }
}

// 使用
UserService product = context.getBean("myBean", UserService.class);        // 产品对象
MyFactoryBean factory = context.getBean("&myBean", MyFactoryBean.class);   // FactoryBean 自身
```

##### 4.2.4 生命周期差异

```
FactoryBean 自身的生命周期（正常流程）：
  实例化 → 属性填充 → Aware → 初始化 → 就绪

getObject() 产品的生命周期：
  getObject() 被调用 → 产品对象就绪（不走容器的属性填充和初始化）
```

- 如果 `isSingleton()` 返回 `true`，Spring 会缓存 `getObject()` 的结果，后续获取同一对象
- 如果 `isSingleton()` 返回 `false`，每次 `getBean()` 都会调用 `getObject()` 创建新对象

##### 4.2.5 Spring 内部的典型使用

| 场景 | FactoryBean 实现 | 说明 |
|------|-----------------|------|
| AOP 代理 | `ProxyFactoryBean` | 创建代理对象 |
| MyBatis Mapper | `MapperFactoryBean` | 创建 Mapper 代理 |
| JNDI 查找 | `JndiObjectFactoryBean` | 从 JNDI 获取对象 |
| 事务代理 | `TransactionProxyFactoryBean` | 创建事务代理 |

##### 4.2.6 使用时机

**什么时候用？** 需要自定义 Bean 的创建过程，且创建逻辑比简单的 `new` 复杂时。

**典型场景：**
- 整合第三方框架，需要通过特定 API 创建对象（如 MyBatis 的 `SqlSessionFactory.getMapper()`）
- 创建代理对象，需要在代理中加入额外逻辑
- 需要根据条件返回不同类型的对象

> **与 @Bean 的区别：** `@Bean` 方法也能自定义创建逻辑，但它是声明式的、写在配置类中。`FactoryBean` 是编程式的、独立的类，更适合封装可复用的创建逻辑（如 starter 中）。

---

### 5. 销毁阶段

#### 5.1 三种销毁方式

**@PreDestroy（推荐首选）**

```java
@Component
public class UserService {
    @PreDestroy
    public void cleanup() {
        System.out.println("资源清理");
    }
}
```

**DisposableBean接口**

```java
@Component
public class DataSourceConfig implements DisposableBean {
    @Override
    public void destroy() throws Exception {
        System.out.println("容器关闭前执行");
    }
}
```

**@Bean destroyMethod**

```java
@Configuration
public class BeanConfig {
    @Bean(destroyMethod = "customDestroy")
    public ThirdPartyService thirdPartyService() {
        return new ThirdPartyService();
    }
}
```

#### 5.2 销毁方法自动推断

Spring 会自动检测实现了 `AutoCloseable` / `Closeable` 接口的 Bean，并在销毁时自动调用 `close()` 方法。`@Bean` 注解的 `destroyMethod` 属性默认值是 `"(inferred)"`，表示由 Spring 自动推断。

```java
// Spring 会自动发现 close() 方法并在销毁时调用
public class MyResource implements AutoCloseable {
    @Override
    public void close() {
        System.out.println("自动关闭");
    }
}

// 如果不想让 Spring 自动调用 close()，显式设置为空字符串
@Bean(destroyMethod = "")
public MyResource myResource() {
    return new MyResource();
}
```

#### 5.3 手动关闭容器触发销毁

```java
public class Application {
    public static void main(String[] args) {
        ConfigurableApplicationContext context = SpringApplication.run(Application.class, args);
        // 业务逻辑...

        // 关闭容器，触发销毁方法
        context.close();
    }
}
```

**注意：** 只有正常关闭Spring容器，销毁方法才会被调用。

---

### 6. 作用域差异

#### 6.1 singleton作用域（默认）

- 容器启动时创建Bean
- 容器关闭时销毁Bean
- 初始化和销毁方法都会执行

```java
@Component
@Scope("singleton")  // 可省略，默认就是singleton
public class UserService { }
```

#### 6.2 prototype作用域

- 调用getBean()时创建
- 容器不负责销毁，需手动管理
- 初始化方法执行，销毁方法**不执行**

```java
@Component
@Scope("prototype")
public class OrderService {
    @PostConstruct
    public void init() {
        System.out.println("初始化");  // 会执行
    }

    @PreDestroy
    public void destroy() {
        System.out.println("不会被调用");  // 不会执行
    }
}
```

---

### 7. 初始化阶段进阶

#### 7.1 Aware 接口详解

##### 7.1.1 常用 Aware 接口速查

| 接口 | 方法 | 获取内容 | 使用场景 |
|------|------|----------|----------|
| BeanNameAware | setBeanName() | Bean在容器中的名称 | 日志记录、动态代理 |
| BeanFactoryAware | setBeanFactory() | BeanFactory实例 | 编程式访问容器 |
| ApplicationContextAware | setApplicationContext() | ApplicationContext实例 | 获取其他Bean、发布事件 |
| EnvironmentAware | setEnvironment() | Environment实例 | 读取配置属性 |
| BeanClassLoaderAware | setBeanClassLoader() | ClassLoader实例 | 动态加载类 |

##### 7.1.2 使用示例

```java
@Component
public class AwareBean implements BeanNameAware, ApplicationContextAware {

    private String beanName;
    private ApplicationContext applicationContext;

    @Override
    public void setBeanName(String name) {
        this.beanName = name;
    }

    @Override
    public void setApplicationContext(ApplicationContext context) {
        this.applicationContext = context;
        // 可以在这里获取其他Bean
        UserService userService = context.getBean(UserService.class);
    }
}
```

##### 7.1.3 典型使用场景

**场景：工厂模式 — 运行时按名称获取 Bean**

```java
public class MyFactory implements ApplicationContextAware {
    private ApplicationContext applicationContext;

    public Object getBean(String name) {
        return applicationContext.getBean(name);
    }

    @Override
    public void setApplicationContext(ApplicationContext ctx) {
        this.applicationContext = ctx;
    }
}
```

> **为什么用 ApplicationContextAware 而不是直接 @Autowired？** 因为工厂需要在运行时根据动态名称获取 Bean，而 @Autowired 只能注入固定的 Bean。

#### 7.2 BeanPostProcessor 详解

##### 7.2.1 作用与原理

BeanPostProcessor 允许在 Bean 初始化前后进行统一拦截处理，是 Spring 框架的核心扩展机制。

两个关键方法：
- `postProcessBeforeInitialization`：第4步，初始化方法执行前调用
- `postProcessAfterInitialization`：第6步，初始化方法执行后调用

##### 7.2.2 重要特性

- 作用于容器内**所有 Bean**，而非单个 Bean
- 可通过 beanName 或类型判断实现针对性处理
- 可以返回代理对象替换原始对象（Spring AOP 基于此机制）

##### 7.2.3 常见应用场景

- AOP 代理生成（Spring AOP 在此生成代理对象）
- @PostConstruct/@PreDestroy 处理（`InitDestroyAnnotationBeanPostProcessor`）
- 统一日志记录、权限校验、属性修改
- **注意：** @Autowired 注入由 `AutowiredAnnotationBeanPostProcessor` 处理，但它实现的是 `InstantiationAwareBeanPostProcessor`，在属性填充阶段（第2步）执行，不在此阶段

##### 7.2.4 自定义示例

```java
@Component
public class MyBeanPostProcessor implements BeanPostProcessor {

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        // 只对特定类型的 Bean 做处理
        if (bean instanceof MyService) {
            System.out.println("在 " + beanName + " 初始化之前做点什么");
        }
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        // 可以返回代理对象
        return bean;
    }
}
```

---

## 第三部分：容器级生命周期（Bean 实例化之前）

> 以下接口在 Bean 实例化**之前**执行，按执行顺序排列。操作的是 Bean 的"元数据"（BeanDefinition），而不是 Bean 实例本身。

---

### 8. ApplicationContextInitializer

#### 8.1 是什么

在容器刷新**之前**最早期执行的钩子，比所有 Bean 的创建都早。

#### 8.2 与 Bean 生命周期的关系

```
ApplicationContextInitializer.initialize()    ← 最早
     ↓
BeanDefinitionRegistryPostProcessor          ← 容器级
     ↓
BeanFactoryPostProcessor                     ← 容器级
     ↓
Bean 实例化、属性填充、初始化...              ← Bean 级
```

#### 8.3 通用示例

```java
public class MyInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    private static ConfigurableApplicationContext context;

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        context = applicationContext;  // 保存容器引用
    }

    // 后续任何地方都可以通过静态方法获取容器
    public static ApplicationContext getApplicationContext() {
        return context;
    }
}
```

注册方式（`META-INF/spring.factories`）：

```properties
# ApplicationContextInitializer 的注册始终使用 META-INF/spring.factories
# 不受 Spring Boot 3.0 自动配置文件格式变更影响（AutoConfiguration 从 spring.factories 迁移到了 .imports，但 Initializer 没变）
org.springframework.context.ApplicationContextInitializer=\
  com.example.MyInitializer
```

#### 8.4 使用时机

**什么时候用？** 需要在所有 Bean 创建之前、最早的阶段获取容器引用或做全局初始化。

**典型场景：**
- 保存 ApplicationContext 到静态变量，供后续非 Spring 管理的代码使用
- 在容器刷新之前注册自定义的 PropertySource
- 在最早期做一些环境检测或初始化工作

> **与 BeanDefinitionRegistryPostProcessor 的区别：** ApplicationContextInitializer 更早，但它不能操作 BeanDefinitionRegistry。如果需要动态注册 Bean，应该用 BeanDefinitionRegistryPostProcessor。

---

### 9. BeanDefinitionRegistryPostProcessor

#### 9.1 是什么

Spring Bean 生命周期中第二个执行的扩展点（仅次于 ApplicationContextInitializer），允许在 Bean 定义阶段**注册、修改或移除** BeanDefinition。

#### 9.2 与 BeanFactoryPostProcessor 的区别

| 维度 | BeanDefinitionRegistryPostProcessor | BeanFactoryPostProcessor |
|------|-------------------------------------|--------------------------|
| **执行顺序** | 先执行 | 后执行 |
| **核心能力** | 可以**新增** BeanDefinition | 只能**修改**已有的 BeanDefinition |
| **典型用途** | 根据配置动态注册 Bean | 修改 Bean 属性值、处理占位符 |
| **方法** | `postProcessBeanDefinitionRegistry()` + `postProcessBeanFactory()` | `postProcessBeanFactory()` |

#### 9.3 关键概念

| 概念 | 说明 |
|------|------|
| `BeanDefinitionRegistry` | Bean 定义注册器，可通过它注册、移除、查询 Bean 定义 |
| `RootBeanDefinition` | Bean 定义的具体实现类，包含 Bean 的类型、构造参数、作用域等信息 |
| `RuntimeBeanReference` | "运行时 Bean 引用"，告诉 Spring 在创建 Bean 时注入另一个已有的 Bean |
| `PriorityOrdered` | 控制执行顺序，`HIGHEST_PRECEDENCE` = 最高优先级 |

#### 9.4 通用示例：根据配置动态注册 Bean

```java
public class MyBeanRegistrar implements BeanDefinitionRegistryPostProcessor, PriorityOrdered {

    private final Environment environment;

    public MyBeanRegistrar(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) {
        // 1. 从配置中读取需要注册的 Bean 信息
        // 2. 为每个 Bean 构建 RootBeanDefinition
        RootBeanDefinition bd = new RootBeanDefinition(MyHandler.class);
        bd.getConstructorArgumentValues().addIndexedArgumentValue(0,
                new RuntimeBeanReference("someDependency"));  // 注入已有 Bean
        bd.getConstructorArgumentValues().addIndexedArgumentValue(1, "paramValue");

        // 3. 注册到容器
        registry.registerBeanDefinition("myHandler", bd);
    }

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) {
        // 通常空实现
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;  // 最高优先级
    }
}
```

#### 9.5 使用时机

**什么时候用？** Bean 还没被实例化，需要根据配置或其他条件**动态新增** Bean 定义时使用。

**典型场景：**
- 框架需要根据用户的 YAML 配置批量注册 Bean，而不是写死在代码里
- 需要根据不同的环境注册不同的 Bean 实现
- 需要在 Bean 定义阶段注入对其他 Bean 的依赖（通过 `RuntimeBeanReference`）

**为什么需要最高优先级？** 因为动态注册的 Bean 需要在其他后处理器执行之前就定义好，否则后续处理器可能找不到这些 Bean。

---

### 10. BeanFactoryPostProcessor

#### 10.1 是什么

在 Bean 实例化**之前**，修改已注册的 BeanDefinition 的属性值。

#### 10.2 典型实现

**PropertySourcesPlaceholderConfigurer**（框架内置，不需要自己写）：

```java
// 它负责处理 ${...} 占位符
@Value("${server.port:8080}")
private int port;
// 在 BeanFactoryPostProcessor 阶段，${server.port:8080} 会被替换为实际值
```

#### 10.3 自定义示例

```java
@Component
public class MyBeanFactoryPostProcessor implements BeanFactoryPostProcessor {

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) {
        // 获取某个 Bean 的定义，修改其属性默认值
        BeanDefinition bd = beanFactory.getBeanDefinition("myService");
        bd.getPropertyValues().add("timeout", "5000");
    }
}
```

#### 10.4 使用时机

**什么时候用？** Bean 定义已注册，但需要在实例化之前**修改其元数据**。

**典型场景：**
- 根据环境动态修改 Bean 的属性默认值
- 条件性地启用/禁用某些 Bean
- 需要在 Bean 创建之前修改其元数据

> **注意：** 日常开发中很少需要自定义 BeanFactoryPostProcessor，大部分场景用 `@ConditionalOnProperty` 等注解就够了。

---

### 11. Spring Boot 自动配置

#### 11.1 AutoConfiguration.imports（Spring Boot 3.0 方式）

**文件位置：** `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`

**作用：** 告诉 Spring Boot 要加载哪些自动配置类。Spring Boot 启动时会扫描所有 jar 包中的这个文件，自动加载其中声明的配置类。

**示例：**

```
# 文件内容：每行一个配置类的全限定名
com.example.config.MyAutoConfiguration
```

> **替代方案：** Spring Boot 2.x 使用 `META-INF/spring.factories`，3.0+ 改用 `.imports` 文件。

#### 11.2 @AutoConfigureBefore / @AutoConfigureAfter

**作用：** 控制自动配置类的加载顺序。

```java
// 在官方 Redisson 配置之前执行，确保使用自定义配置
@AutoConfigureBefore(value = {RedissonAutoConfiguration.class})
public class MyRedissonAutoConfiguration {
    // 自定义 RedissonClient 创建逻辑
}
```

**使用时机：** 自定义配置需要在官方默认配置之前执行时。比如需要拦截并替代默认的 Bean 创建逻辑。

#### 11.3 @EnableConfigurationProperties

**作用：** 将 YAML 配置绑定到 Java 对象，并注册为 Spring Bean。

```java
@EnableConfigurationProperties(MyProperties.class)
public class MyAutoConfiguration { }

@Data
@ConfigurationProperties(prefix = "my-app")
public class MyProperties {
    private String name;
    private int timeout = 3000;
}
```

对应 YAML：

```yaml
my-app:
  name: test
  timeout: 5000
```

#### 11.4 Binder — 类型安全配置绑定

**作用：** Spring Boot 2.0+ 引入，将配置文件中的属性值绑定到 Java 对象。

**为什么需要 Binder？** 在 `BeanDefinitionRegistryPostProcessor` 中运行时，`@ConfigurationProperties` 注入还没完成，只能用 `Binder` 手动读取配置。

```java
private Map<String, MyConfig> resolveConfig(Environment environment) {
    Binder binder = Binder.get(environment);
    return binder
            .bind("my-app.items", Bindable.mapOf(String.class, MyConfig.class))
            .orElse(Collections.emptyMap());
}
```

#### 11.5 使用时机

**什么时候用？** 开发可复用的框架/starter 时，需要让框架的 Bean 自动注册到使用者的容器中。

**典型场景：**
- 开发 Spring Boot Starter，让引入依赖即生效
- 自定义配置需要在官方默认配置之前执行
- 在 Bean 定义阶段需要读取配置（用 Binder）

---

## 第四部分：应用运行阶段

> 所有 Bean 已创建完成，应用开始运行。

---

### 12. ApplicationListener 事件机制

#### 12.1 是什么

Spring 提供的**观察者模式**事件机制：一个组件发布事件，其他组件监听并响应。

#### 12.2 常用事件类型

| 事件 | 触发时机 | 说明 |
|------|----------|------|
| `ApplicationContextInitializedEvent` | 容器刷新前 | ApplicationContext 准备好但未刷新 |
| `ContextRefreshedEvent` | 容器刷新完成 | 所有 Bean 已初始化 |
| `ApplicationStartedEvent` | 应用启动完成 | 所有 Bean 已就绪，CommandLineRunner 之前 |
| `ApplicationReadyEvent` | 应用就绪 | 完全就绪，可以接受请求 |

#### 12.3 通用示例：监听启动完成事件

```java
@Component
public class MyStartupListener implements ApplicationListener<ApplicationStartedEvent> {

    @Override
    public void onApplicationEvent(ApplicationStartedEvent event) {
        // 此时所有 Bean 都已就绪，可以安全地获取任何 Bean
        ApplicationContext ctx = event.getApplicationContext();
        MyService myService = ctx.getBean(MyService.class);
        myService.init();
    }
}
```

#### 12.4 与 @PostConstruct 的区别

| 维度 | @PostConstruct | SmartInitializingSingleton | ApplicationListener\<ApplicationStartedEvent\> |
|------|---------------|---------------------------|------------------------------------------------|
| **执行时机** | 该 Bean 初始化时（第5步） | 所有单例 Bean 实例化完成后 | 所有 Bean 都已就绪后 |
| **其他 Bean 是否可用** | 不一定（可能还没创建） | 一定可用 | 一定可用 |
| **适用场景** | 初始化自身依赖 | 预热缓存、注册处理器（比事件更精准） | 启动后全局初始化 |
| **粒度** | 单个 Bean | 单个 Bean（但保证在所有单例之后） | 全局 |

> **SmartInitializingSingleton：** 实现该接口的 Bean，在所有单例 Bean 都实例化完成后回调 `afterSingletonsInstantiated()`。比 `ApplicationListener<ContextRefreshedEvent>` 更精准（事件可能触发多次），适合需要确保所有 Bean 就绪后才执行的初始化逻辑。
>
> **@PostConstruct 线程安全说明：** @PostConstruct 在单例 Bean 的创建锁内执行。如果其中有耗时操作（如远程调用），可能阻塞其他 Bean 的创建，甚至导致死锁。此时应改用 `SmartInitializingSingleton` 或 `ApplicationListener`，它们在所有 Bean 创建完成后执行，不在锁内。

#### 12.5 使用时机

**什么时候用？** 需要在所有 Bean 都已就绪之后执行逻辑，且该逻辑**依赖其他 Bean**。

**典型场景：**
- 启动完成后初始化消费者线程
- 启动完成后预热缓存
- 启动完成后注册 shutdown hook
- 需要获取所有某个类型的 Bean 做统一初始化

> **为什么不用 @PostConstruct？** 因为 @PostConstruct 执行时，其他 Bean 可能还没创建完成。如果 @PostConstruct 中依赖的 Bean 还没初始化，会出问题。ApplicationListener 能保证所有 Bean 已就绪。

---

### 13. Lifecycle / SmartLifecycle

#### 13.1 是什么

`Lifecycle` 接口定义了 Bean 的**启动/停止**语义，与 `InitializingBean`/`DisposableBean` 的语义不同：

| 接口 | 语义 | 时机 |
|------|------|------|
| `@PostConstruct` / `InitializingBean` | Bean 组装完成 | 初始化阶段（Bean 创建过程中） |
| `Lifecycle.start()` / `stop()` | 启动 / 停止**运行** | 所有 Bean 就绪后 / 容器关闭前 |
| `SmartLifecycle` | 带阶段排序的启停 | 按 `phase` 先后有序执行 |

#### 13.2 接口定义

```java
public interface Lifecycle {
    void start();           // 启动
    void stop();            // 停止
    boolean isRunning();    // 是否正在运行
}

public interface SmartLifecycle extends Lifecycle, Phased {
    int DEFAULT_PHASE = Integer.MAX_VALUE;
    default boolean isAutoStartup() { return true; }   // 是否随容器自动启动
    default void stop(Runnable callback) { stop(); callback.run(); }  // 异步停止
    default int getPhase() { return DEFAULT_PHASE; }    // 阶段值（越小越先启动，越大越先停止）
}
```

**源码层级结构：**

```
Lifecycle
  ├── start()
  ├── stop()
  └── isRunning()
  │
  ├── SmartLifecycle extends Lifecycle, Phased
  │     ├── isAutoStartup()
  │     ├── stop(Runnable)
  │     └── getPhase()
  │
  └── LifecycleProcessor (内部接口)
        └── DefaultLifecycleProcessor (实际执行者)
              ├── onRefresh()   → startBeans(isAutoStartup)   ← 容器刷新后自动调用
              └── onClose()     → stopBeans()                  ← 容器关闭时自动调用
```

#### 13.3 执行顺序

`SmartLifecycle` 的 `getPhase()` 控制启停顺序：

- **启动时：** phase 值小的先启动（`Integer.MIN_VALUE` 最先）
- **停止时：** phase 值大的先停止（与启动顺序相反，确保依赖关系正确）

```
启动顺序：
  phase=-1 的 Bean.start()
       ↓
  phase=0 的 Bean.start()
       ↓
  phase=Integer.MAX_VALUE 的 Bean.start()  ← DEFAULT_PHASE

停止顺序（反向）：
  phase=Integer.MAX_VALUE 的 Bean.stop()
       ↓
  phase=0 的 Bean.stop()
       ↓
  phase=-1 的 Bean.stop()
```

#### 13.4 通用示例

```java
@Component
public class MessageConsumer implements SmartLifecycle {

    private volatile boolean running = false;

    @Override
    public void start() {
        // 所有 Bean 就绪后才启动消费者
        running = true;
        System.out.println("消息消费者启动");
    }

    @Override
    public void stop() {
        // 容器关闭时先停止消费新消息
        running = false;
        System.out.println("消息消费者停止");
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public int getPhase() {
        return 0;  // 中间阶段（值越小越先启动，默认值 Integer.MAX_VALUE）
    }
}
```

#### 13.5 与 ApplicationListener 的区别

| 维度 | SmartLifecycle | ApplicationListener\<ApplicationStartedEvent\> |
|------|---------------|------------------------------------------------|
| **语义** | 启动/停止运行 | 响应事件 |
| **停止支持** | 有 `stop()` 方法，容器关闭时自动调用 | 无停止语义 |
| **顺序控制** | 通过 `getPhase()` 精确控制 | 无内置顺序控制 |
| **适用场景** | 需要启停控制的组件（消费者、定时任务） | 一次性初始化逻辑 |

#### 13.6 使用时机

**什么时候用？** 需要在所有 Bean 就绪后**启动运行**，且在容器关闭时需要**优雅停止**的组件。

**典型场景：**
- 消息消费者：启动后开始监听，关闭前停止接收新消息
- 定时任务调度器：启动后开始调度，关闭前停止调度
- 长连接管理：启动后建立连接，关闭前断开连接
- 需要按依赖顺序启停的多个组件（通过 `getPhase()` 控制）

> **为什么不直接用 @PostConstruct？** 因为 @PostConstruct 是"组装完成"的语义，不是"启动运行"的语义。在 @PostConstruct 中启动消息监听，可能其他 Bean 还没初始化完，导致依赖不可用。

---

## 第五部分：实战指南

---

### 14. 场景选择决策表

#### 14.1 决策表

| 场景 | 推荐机制 | 执行时机 | 原因 |
|------|----------|----------|------|
| 根据配置动态注册 Bean | BeanDefinitionRegistryPostProcessor | Bean 实例化之前 | 需要操作 BeanDefinition |
| 修改已有 BeanDefinition 的属性 | BeanFactoryPostProcessor | Bean 实例化之前 | 需要修改元数据 |
| 实例化阶段拦截 / 自定义属性注入 | InstantiationAwareBeanPostProcessor | 实例化前后 | 短路创建或自定义注入 |
| Bean 初始化后做统一拦截 | BeanPostProcessor | 每个 Bean 初始化前后 | 作用于所有 Bean |
| 单个 Bean 的初始化逻辑 | @PostConstruct | 该 Bean 初始化时 | 最简洁，推荐首选 |
| 自定义 Bean 创建逻辑（可复用） | FactoryBean | getObject() 被调用时 | 工厂模式，适合封装复杂创建 |
| 获取容器引用做工厂模式 | ApplicationContextAware | 该 Bean 初始化时 | 需要运行时按名称获取 Bean |
| 最早期保存容器引用 | ApplicationContextInitializer | 容器刷新之前 | 比所有 Bean 创建都早 |
| 所有单例 Bean 就绪后执行逻辑 | SmartInitializingSingleton | 所有单例实例化完成后 | 比事件更精准，适合预热缓存 |
| 所有 Bean 就绪后执行逻辑 | ApplicationListener\<ApplicationStartedEvent\> | 所有 Bean 就绪后 | 依赖其他 Bean |
| 需要启停控制的组件 | SmartLifecycle | 所有 Bean 就绪后启动 | 有 start/stop 语义，支持阶段排序 |
| 控制自动配置顺序 | @AutoConfigureBefore | 自动配置加载时 | 框架级配置顺序控制 |
| 第三方类的初始化/销毁 | @Bean(initMethod/destroyMethod) | 该 Bean 初始化/销毁时 | 无法修改源码 |
| 外部对象注册到容器 | registerSingleton | 运行时 | 对象已创建，需纳入容器管理 |

#### 14.2 快速决策流程

```
需要在什么阶段操作？
  │
  ├── 容器刷新之前（最早期，无 Bean 可用）
  │     └── 需要保存容器引用或注册 PropertySource → ApplicationContextInitializer
  │
  ├── Bean 创建之前（操作元数据）
  │     ├── 需要新增 BeanDefinition → BeanDefinitionRegistryPostProcessor
  │     └── 需要修改已有 BeanDefinition → BeanFactoryPostProcessor
  │
  ├── Bean 创建过程中
  │     ├── 需要在实例化阶段拦截 / 自定义属性注入 → InstantiationAwareBeanPostProcessor
  │     ├── 需要统一拦截所有 Bean 初始化 → BeanPostProcessor
  │     ├── 需要初始化单个 Bean → @PostConstruct
  │     ├── 需要自定义 Bean 创建逻辑（可复用） → FactoryBean
  │     └── 需要获取容器引用 → ApplicationContextAware
  │
  └── 所有 Bean 就绪后
        ├── 需要所有单例就绪后立即执行 → SmartInitializingSingleton
        ├── 需要启停控制（start/stop） → SmartLifecycle
        └── 需要启动完成后执行 → ApplicationListener<ApplicationStartedEvent>
```

#### 14.3 五种初始化钩子对比

| 维度 | @PostConstruct | SmartInitializingSingleton | SmartLifecycle | ApplicationListener | ApplicationContextInitializer |
|------|---------------|---------------------------|---------------|--------------------|-----------------------------|
| **执行时机** | 该 Bean 初始化时 | 所有单例实例化完成后 | 所有 Bean 就绪后 | 所有 Bean 就绪后 | 容器刷新之前 |
| **其他 Bean 是否可用** | 不一定 | 一定可用 | 一定可用 | 一定可用 | 没有 Bean 可用 |
| **能否操作 BeanDefinition** | 不能 | 不能 | 不能 | 不能 | 不能 |
| **停止支持** | 无 | 无 | 有 stop() | 无 | 无 |
| **顺序控制** | 无 | 无 | getPhase() | 无 | 无 |
| **典型用途** | 初始化自身 | 预热缓存、注册处理器 | 启停控制（消费者、调度器） | 启动后全局初始化 | 最早期保存容器引用 |
| **使用频率** | 高 | 低 | 低 | 中 | 低 |

---

### 15. 手动注册 Bean（registerSingleton）

#### 15.1 是什么

正常情况下，Spring 通过 `@Component`、`@Bean` 等方式自动创建和管理 Bean。但有时候对象可能是**外部创建好的**，需要手动注册到 Spring 容器中。

#### 15.2 核心代码

```java
// 获取 BeanFactory
DefaultListableBeanFactory factory =
    (DefaultListableBeanFactory) context.getAutowireCapableBeanFactory();

// 准备好对象
UserService userService = new UserService();

// 手动注册
factory.registerSingleton("myUserService", userService);

// 现在可以通过容器获取了
UserService bean = factory.getBean("myUserService", UserService.class);
```

#### 15.3 使用场景

- Spring Boot 启动后动态注册 Bean（如从数据库加载配置对象）
- 整合非 Spring 管理的第三方对象
- 测试时模拟 Spring 容器

#### 15.4 注意事项

- registerSingleton 注册的 Bean **不走正常的生命周期流程**（没有实例化→属性填充→初始化）
- 如果需要完整生命周期，可以用 `registerBean()` 方法替代
- 注册后的 Bean 是 singleton，后续获取都是同一个对象
