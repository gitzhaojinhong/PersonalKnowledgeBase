# Bean生命周期

> Spring Boot中Bean生命周期的完整指南，生产常用内容前置，原理拓展后置。

## 一、快速查询：生命周期执行顺序与实现方式

### 1.1 完整十步流程

**创建阶段：**

#### **第1步：实例化**

- **做什么：** 调用构造器，创建对象
- **如何实现：** 定义Bean类，Spring通过构造器反射创建
- **代码位置：** 自定义类的构造方法

```java
@Component
public class UserService {
    public UserService() {  // 第1步在这里执行
        System.out.println("对象被创建了");
    }
}
```

---

#### **第2步：属性填充（依赖注入）**

- **做什么：** 注入依赖（@Autowired、@Value、@Resource等）
- **如何实现：** 使用依赖注入注解或配置
- **代码位置：** 类的成员变量或setter方法

```java
@Component
public class OrderService {
    @Autowired  // 第2步：注入UserService
    private UserService userService;

    @Value("${timeout:30}")  // 第2步：注入配置值
    private int timeout;
}
```

---

#### **第3步：Aware接口回调**

- **做什么：** 让Bean获取Spring容器内部信息
- **如何实现：** 实现相应的Aware接口
- **常用接口：** BeanNameAware、BeanFactoryAware、ApplicationContextAware

```java
@Component
public class AwareBean implements BeanNameAware, ApplicationContextAware {

    private String beanName;  // 第3步：获取Bean名称
    private ApplicationContext ctx;  // 第3步：获取容器

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

---

#### **第4步：BeanPostProcessor前置处理**

- **做什么：** 初始化之前的统一拦截
- **如何实现：** 实现BeanPostProcessor接口
- **常见应用：** AOP代理生成、@Autowired处理（框架层面）

```java
@Component
public class MyBeanPostProcessor implements BeanPostProcessor {

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        System.out.println("在" + beanName + "的初始化之前调用");
        return bean;  // 可以返回代理对象替换原对象
    }
}
```

---

#### **第5步：初始化方法**

- **做什么：** 执行自定义初始化逻辑
- **如何实现：** 三种方式，执行顺序固定
  1. @PostConstruct 注解方法
  2. InitializingBean.afterPropertiesSet()
  3. @Bean(initMethod = "xxx")

**方式一：@PostConstruct（最常用）**

```java
@Component
public class UserService {
    @PostConstruct  // 第5步：方式1
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
    public void afterPropertiesSet() throws Exception {  // 第5步：方式2
        System.out.println("属性填充完成后执行");
    }
}
```

**方式三：@Bean指定（常用于第三方类）**

```java
@Configuration
public class BeanConfig {
    @Bean(initMethod = "customInit")  // 第5步：方式3
    public ThirdPartyService thirdPartyService() {
        return new ThirdPartyService();
    }
}
```

---

#### **第6步：BeanPostProcessor后置处理**

- **做什么：** 初始化之后的统一拦截
- **如何实现：** 实现BeanPostProcessor接口
- **常见应用：** AOP代理对象生成（Spring AOP在此生成代理）

```java
@Component
public class MyBeanPostProcessor implements BeanPostProcessor {

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        System.out.println("在" + beanName + "的初始化之后调用");
        return bean;  // 通常在这里返回代理对象
    }
}
```

---

#### **第7步：Bean就绪**

- **做什么：** 放入单例池，对外提供服务
- **如何实现：** 无需手动操作，Spring自动完成
- **说明：** 此时Bean已完全初始化，可正常注入到其他Bean使用

---

**销毁阶段（容器关闭时）：**

---

#### **第8步：@PreDestroy销毁前回调**

- **做什么：** 容器关闭前执行清理逻辑
- **如何实现：** 使用@PreDestroy注解

```java
@Component
public class UserService {
    @PreDestroy  // 第8步
    public void cleanup() {
        System.out.println("资源清理");
    }
}
```

---

#### **第9步：DisposableBean.destroy()**

- **做什么：** 实现销毁接口执行清理
- **如何实现：** 实现DisposableBean接口

```java
@Component
public class DataSourceConfig implements DisposableBean {
    @Override
    public void destroy() throws Exception {  // 第9步
        System.out.println("容器关闭前执行");
    }
}
```

---

#### **第10步：@Bean destroyMethod**

- **做什么：** 配置指定销毁方法
- **如何实现：** @Bean的destroyMethod属性

```java
@Configuration
public class BeanConfig {
    @Bean(destroyMethod = "customDestroy")  // 第10步
    public ThirdPartyService thirdPartyService() {
        return new ThirdPartyService();
    }
}
```

---

### 1.2 初始化方法执行顺序（固定）

```
1. @PostConstruct 注解方法
2. InitializingBean.afterPropertiesSet()
3. @Bean(initMethod = "xxx")
```

### 1.3 销毁方法执行顺序（固定）

```
1. @PreDestroy 注解方法
2. DisposableBean.destroy()
3. @Bean(destroyMethod = "xxx")
```

---

## 二、完整生命周期演示

### 2.1 BeanPostProcessor

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

### 2.2 实现所有回调接口的Bean

```java
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.*;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

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

    // 这里通过@Autowired注入，相当于第2步属性填充

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

### 2.3 运行结果

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

## 三、生产常用：初始化与销毁用法对比

### 3.1 三种方式对比

**@PostConstruct/@PreDestroy（推荐首选）**

- 代码简洁，注解清晰
- Spring Boot 2.x+原生支持
- 适合自定义开发的类

**InitializingBean/DisposableBean（次选）**
- 需要实现接口
- 可以访问容器API
- 适合需要在初始化时做复杂操作的场景

**@Bean initMethod/destroyMethod（按需使用）**
- 用于第三方类，不想修改源码
- 在配置类中指定方法名

### 3.2 @PostConstruct与@PreDestroy完整示例

```java
import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import org.springframework.stereotype.Component;

@Component
public class UserService {

    @PostConstruct
    public void init() {
        System.out.println("Bean初始化完成，执行初始化工件");
    }

    @PreDestroy
    public void destroy() {
        System.out.println("Bean即将销毁，执行清理工作");
    }
}
```

### 3.3 InitializingBean与DisposableBean完整示例

```java
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.stereotype.Component;

@Component
public class DataSourceConfig implements InitializingBean, DisposableBean {

    @Override
    public void afterPropertiesSet() throws Exception {
        System.out.println("属性填充完成后执行");
    }

    @Override
    public void destroy() throws Exception {
        System.out.println("容器关闭前执行");
    }
}
```

### 3.4 @Bean配置完整示例

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class BeanConfig {

    @Bean(initMethod = "customInit", destroyMethod = "customDestroy")
    public MyService myService() {
        return new MyService();
    }
}
```

对应的MyService类：

```java
public class MyService {
    public void customInit() {
        System.out.println("自定义初始化方法");
    }

    public void customDestroy() {
        System.out.println("自定义销毁方法");
    }
}
```

---

## 四、手动关闭容器触发销毁

Spring Boot中：

```java
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;

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

## 五、Bean作用域与生命周期差异

### 5.1 singleton作用域（默认）

- 容器启动时创建Bean
- 容器关闭时销毁Bean
- 初始化和销毁方法都会执行

```java
@Component
@Scope("singleton")  // 可省略，默认就是singleton
public class UserService {
    // ...
}
```

### 5.2 prototype作用域

- 调用getBean()时创建
- 容器不负责销毁，需手动管理
- 初始化方法执行，销毁方法不执行

```java
@Component
@Scope("prototype")
public class OrderService {
    @PostConstruct
    public void init() {
        System.out.println("初始化");
    }

    @PreDestroy
    public void destroy() {
        System.out.println("这个方法不会被调用");
    }
}
```

---

## 七、手动将对象交给Spring管理（registerSingleton）

### 7.1 这个功能是干什么的

正常情况下，Spring通过`@Component`、`@Bean`等方式自动创建和管理Bean。

但有时候，对象可能是**外部创建好的**（比如从数据库查出来的、从配置文件读取的、第三方库给的），这时需要**手动把这个对象注册到Spring容器中**，让它也能被`@Autowired`注入使用。

### 7.2 核心代码

```java
import org.springframework.beans.factory.support.DefaultListableBeanFactory;

// 1. 创建BeanFactory（类似一个小容器）
DefaultListableBeanFactory factory = new DefaultListableBeanFactory();

// 2. 准备好对象（这个对象可能来自任何地方）
UserService userService = new UserService();
userService.setName("张三");

// 3. 手动注册到Spring容器
factory.registerSingleton("myUserService", userService);

// 4. 现在可以通过容器获取了
UserService bean = factory.getBean("myUserService", UserService.class);
System.out.println(bean.getName());  // 输出：张三
```

### 7.3 实际使用场景

**场景1：Spring Boot启动后动态注册Bean**

```java
@Component
public class DataInitializer {

    @Autowired
    private ApplicationContext context;

    @PostConstruct
    public void init() {
        // 假设从数据库查出了一批配置对象
        List<Config> configs = configService.loadFromDB();

        // 逐个注册到Spring容器
        DefaultListableBeanFactory factory =
            (DefaultListableBeanFactory) context.getAutowireCapableBeanFactory();

        for (Config config : configs) {
            ConfigBean bean = new ConfigBean(config);
            factory.registerSingleton("config_" + config.getId(), bean);
        }
    }
}
```

注册之后，其他地方就能通过名字注入了：

```java
@Autowired
@Qualifier("config_001")
private ConfigBean configBean;
```

**场景2：整合非Spring管理的第三方对象**

```java
@Component
public class ThirdPartyBridge {

    @Autowired
    private ApplicationContext context;

    public void integrate() {
        // 第三方SDK创建的对象
        ThirdPartyClient client = ThirdPartySDK.createClient();

        // 手动注册到Spring，这样就能被其他Bean注入了
        DefaultListableBeanFactory factory =
            (DefaultListableBeanFactory) context.getAutowireCapableBeanFactory();
        factory.registerSingleton("thirdPartyClient", client);
    }
}
```

之后可以正常使用：

```java
@Service
public class MyService {
    @Autowired
    private ThirdPartyClient thirdPartyClient;  // 正常使用
}
```

**场景3：测试时模拟Spring容器**

```java
@Test
public void testService() {
    // 创建模拟容器
    DefaultListableBeanFactory factory = new DefaultListableBeanFactory();

    // 注册模拟对象
    UserRepository mockRepo = mock(UserRepository.class);
    factory.registerSingleton("userRepository", mockRepo);

    // 注册待测服务
    UserService userService = new UserService();
    factory.registerSingleton("userService", userService);

    // 测试...
    User result = userService.getUser(1L);
}
```

### 7.4 注意事项

- registerSingleton注册的Bean**不走正常的生命周期流程**（没有实例化→属性填充→初始化这些步骤）
- 如果需要完整生命周期，可以用`registerBean()`方法替代
- 注册后的Bean是singleton，后续获取都是同一个对象

## 八、Aware接口：获取容器内部信息

### 8.1 常用Aware接口速查

| 接口 | 方法 | 获取内容 | 使用场景 |
|------|------|----------|----------|
| BeanNameAware | setBeanName() | Bean在容器中的名称 | 日志记录、动态代理 |
| BeanFactoryAware | setBeanFactory() | BeanFactory实例 | 编程式访问容器 |
| ApplicationContextAware | setApplicationContext() | ApplicationContext实例 | 获取其他Bean、发布事件 |

### 8.2 使用示例

```java
@Component
public class AwareBean implements BeanNameAware, ApplicationContextAware {

    private String beanName;
    private ApplicationContext applicationContext;

    @Override
    public void setBeanName(String name) {
        this.beanName = name;
        System.out.println("当前Bean名称：" + beanName);
    }

    @Override
    public void setApplicationContext(ApplicationContext context) {
        this.applicationContext = context;
        // 可以在这里获取其他Bean
        UserService userService = context.getBean(UserService.class);
    }
}
```



---

## 九、BeanPostProcessor（进阶）

> 以下为进阶内容，如只需日常开发可跳过此章。

### 9.1 作用与原理

BeanPostProcessor允许在Bean初始化前后进行统一拦截处理，是Spring框架的核心扩展机制。

两个关键方法：

- postProcessBeforeInitialization：第4步，初始化方法执行前调用
- postProcessAfterInitialization：第6步，初始化方法执行后调用

### 9.2 基本用法

```java
@Component
public class MyBeanPostProcessor implements BeanPostProcessor {

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        System.out.println("→ 初始化前置：" + beanName);
        return bean;  // 可以返回代理对象
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        System.out.println("← 初始化后置：" + beanName);
        return bean;
    }
}
```

### 9.3 重要特性

- 作用于容器内所有Bean，而非单个Bean
- 可通过beanName或类型判断实现针对性处理
- 可以返回代理对象替换原始对象（Spring AOP基于此机制）

### 9.4 常见应用场景

- AOP代理生成（Spring AOP在此生成代理对象）
- @Autowired处理（AutowiredAnnotationBeanPostProcessor）
- @PostConstruct/@PreDestroy处理（InitDestroyAnnotationBeanPostProcessor）
- 统一日志记录、权限校验、属性修改

