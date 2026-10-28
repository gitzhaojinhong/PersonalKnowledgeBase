## IoC容器

## 概览

### 控制反转与依赖注入

**控制反转(IoC)**：设计理念，强调权力的转移

* **控制**：对象创建和管理的权力
* **反转**：权力交给外部环境(IoC容器)
* 好处：降低耦合度(对象之间的依赖程度降低)、且易于管理

**依赖注入(DI)**：控制反转的具体实现，强调依赖关系的注入方式

* 对象仅通过构造函数入参、工厂方法入参，或是对象实例构造完成 / 从工厂方法返回后所设置的属性，来声明自身所需的依赖（即与之协作的其他对象）。
* IoC 容器在创建 Bean 时，会完成这些依赖的注入。

依赖注入机制本质上做了控制权反转（控制反转由此得名）：不再由 Bean 自身通过直接 new 对象、服务定位器（Service Locator）模式等方式，去实例化或查找所需要的依赖。

### IoC容器

`org.springframework.context.ApplicationContext` 接口即 Spring IoC 容器，负责 Bean 的实例化、配置与装配。容器通过读取配置元数据，获取需要实例化、配置、装配的组件信息。

### Spring Bean

Spring IoC 容器可以管理一个或多个 Bean。这些 Bean 由开发者提供给容器的配置元数据创建。

**BeanDefinition：**

容器内部，每个 Bean 定义对应一个 **BeanDefinition** 对象，存储 Bean 全部元数据：

* 全限定类名：Bean 实现类
* 行为配置：作用域、生命周期回调
* 依赖引用：协作 Bean（协作者 / 依赖）
* 自定义配置：例如连接池最大连接数

BeanDefinition 核心属性： `Class`、`Name`、`Scope`、构造函数参数、属性、自动装配模式、懒初始化、初始化方法、销毁方法。

> 除解析配置生成 BeanDefinition，还可以手动注册外部已经实例化的对象： 通过 `getAutowireCapableBeanFactory()` 获取 `DefaultListableBeanFactory`，调用 `registerSingleton()`、`registerBeanDefinition()`。  **禁止容器运行时新增注册 Bean**，会并发异常、状态不一致；注册操作要尽早执行。

## 依赖管理

### 依赖注入(DI)

#### Bean创建方式

1. `@Component``@Repository``@Service``@Controller`
2. 使用`@Bean`注解
3. `@Import`注解快速导入类到`IoC`容器中，参考："`_@Import_`_配置类组合"_章节

#### Bean注入方式

1. **字段注入(不推荐)**

```java
@Service
public class OrderService {
    @Autowired    
    private InventoryService inventoryService;
}
```

`@Autowired`直接打在成员变量上，利用Java 反射直接给 private 字段赋值。

> 不经过构造器、不调用 set 方法。所以它既不是构造注入、也不是Setter注入。

**缺点：**

* 字段无法声明为`final`
* 字段注入还可能导致隐式的依赖关系——类的使用者无法通过查看构造器签名来了解该类需要哪些依赖。

2. **构造函数注入(推荐)**

```java
@Service
public class OrderService {        
    private final InventoryService inventoryService;    
    private final PaymentService paymentService;        
    // Spring 4.3+单个构造器可省略@Autowired    
    public OrderService(InventoryService inventoryService,                        
                        PaymentService paymentService) {        
        this.inventoryService = inventoryService;        
        this.paymentService = paymentService;    
    }
}
```

容器通过调用带有参数的构造函数来创建 Bean，每个参数对应一个依赖项。这是 Spring 官方强烈推荐的方式。

**优点：**

* 不可变性：依赖可以声明为 `final`，一旦注入便不可更改，确保对象状态的安全性
* 非空保证：对象在创建时必须提供所有必需的依赖，永远不会出现 `NullPointerException` 因依赖未设置而引发的问题
* 完整初始化：对象创建完成后即处于完全初始化状态，调用方无需额外检查

**适用场景：** 所有必需依赖。

3. **Setter 注入(推荐)**

```java
@Service
public class OrderService {        
    private NotificationService notificationService;    
        @Autowired    
        public void setNotificationService(NotificationService notificationService) {        
            this.notificationService = notificationService;    
        }
}
```

容器先通过无参构造函数（或无参静态工厂方法）创建 Bean 实例，然后调用 setter 方法逐一设置依赖。

**优点：**

* 灵活性：对象的依赖可以在运行时被重新配置或重新注入，适合通过 JMX MBeans 进行动态管理
* 可选依赖：对于可以在类内部赋予合理默认值的依赖，Setter 注入不会强迫调用方必须提供

**适用场景**：可选依赖，即那些有合理默认值、非强制性的依赖。、

4. **任意自定义方法注入**

`@Autowired` 直接加在自定义方法上，本质上就是Setter注入

**优点：** 方法名无关紧要，Spring 根据方法参数的类型自动匹配并注入。

***

**`@Autowired`****对比****`@Resource`**

| **维度** | `@Autowired` + `@Qualifier` | `@Resource(name = "...")` |
| --- | --- | --- |
| **是否有 `name`属性** | 否，通过 `@Qualifier`间接实现 | 是，直接通过 `name` 属性 |
| **匹配策略** | 先按类型筛选，再按限定符缩小范围 | 直接按名称查找，类型仅验证兼容性 |
| **语义明确性** | 较低，需要理解类型筛选 + 限定符两层逻辑 | 较高，"按名称引用"语义直接清晰 |
| **对集合注入的支持** | 支持，可注入多个同限定符 Bean | 不支持 |
| **对构造器/多参数方法** | 支持，可在参数级别标注 `@Qualifier` | 不支持，仅字段和单参数 Setter |
| **名称来源** | 限定符值不必与 Bean 名称一致，可以是任意标识 | `name`值必须与 Bean 名称一致。Bean名称使用`@Bean("名称")`或`@Component("名称")` |

**如何选择——Spring 团队的最佳实践**

"使用构造函数注入必需依赖，使用 setter 方法或配置方法注入可选依赖。"

> **预初始化机制**：默认情况下，单例作用域的 Bean 会在容器启动时被预先实例化。这意味着，即使某个 Bean 尚未被任何代码请求使用，Spring 也会在启动阶段就创建它并注入其依赖。这样做的好处是——**配置错误可以尽早暴露**，而不是等到运行时才突然抛出异常。当然，这个默认行为可以通过 `lazy-init` 覆盖。

#### **可选依赖处理**

默认情况下，`@Autowired` 标注的注入点是**必需的**——如果找不到匹配的 Bean，容器会抛出异常。但在某些场景下，依赖是可选的，Spring 提供了三种方式来处理：

1. `required = false`

```java
@Autowired(required = false)
public void setMovieFinder(MovieFinder movieFinder) {
this.movieFinder = movieFinder;
}
```

当依赖不可用时，标注了 `required=false` 的方法**根本不会被调用**，字段则会保持其默认值（对于引用类型为 `null`）。

2. `java.util.Optional`

```java
@Autowired
public void setMovieFinder(Optional<MovieFinder> movieFinder) {
    movieFinder.ifPresent(mf -> this.movieFinder = mf);
}
```

利用 Java 8 的 `Optional` 类型，将依赖声明为可选，语义清晰且类型安全。

3. `@Nullable`

```java
@Autowired
public void setMovieFinder(@Nullable MovieFinder movieFinder) {
    this.movieFinder = movieFinder;
}
```

任何包中的 `@Nullable` 注解均可使用，Spring 会识别并将其视为可选依赖。



#### 自我注入

自引用本质上是自循环依赖，是 Spring 提供的兜底方案。其核心行为：对其他组件的常规依赖始终优先，自引用不参与常规自动装配候选选择，永远不是 `@Primary`，始终以最低优先级出现。

| 场景 | 方案 | 推荐度 |
| --- | --- | --- |
| 需要内部调用事务/缓存方法 | 抽取到独立委托 Bean | 最高 |
| 需要获取自身代理 | `@Resource` 按名称注入 | 高 |
| 需要避免循环依赖 | `@Autowired @Lazy`延迟注入 | 中 |
| 编程式获取 | `ApplicationContext#getBean()` | 低（侵入性） |
| 字段 `@Autowired`自引用 | 回退机制，最低优先级 | 最后手段 |
| 构造器自引用 | 直接报错，不可用 | 禁止 |

### 自动装配微调

#### Bean初始化顺序控制

> **依赖关系是存在的，但无法通过常规的依赖注入来表达**——因为目标 Bean 并不需要一个驱动注册 Bean 的实例作为属性。`depends-on` 就是为解决这类"间接依赖"而生的。

**`@DependsOn`告诉Spring ，在初始化当前 Bean 之前，必须先完成指定 Bean 的初始化  。**

1. 在基于注解的配置中，可以使用 `@DependsOn` 注解声明同样的依赖关系：

```java
@Component
@DependsOn({"driverRegistrar", "cacheManager"})
public class DatabaseService {
    // ...
}
```

2. 或者在 `@Configuration` 类中的 `@Bean` 方法上使用：

```java
@Configuration
public class AppConfig {

    @Bean
    @DependsOn("driverRegistrar")
    public DataSource dataSource() {
        // ...
    }
}
```

#### `@Lazy`延迟初始化

在默认情况下，Spring 容器对所有**单例作用域（singleton**）的 Bean 采用**预初始化（eager pre-instantiation**）策略

**`@Lazy`** 提供了一种相反的策略：将 Bean 的创建时机从"启动时"推迟到"**首次被请求时**"。这在某些场景下是合理的，但需要对其底层机制和约束有清晰的理解。

> **预初始化策略**：即在 `ApplicationContext` 启动过程中，就创建并配置好所有单例 Bean。这是 Spring 的默认行为，也是官方推荐的做法，因为其核心优势在于**尽早暴露配置错误**。如果一个 Bean 的依赖缺失、属性配置错误或环境不满足，容器在启动时就会抛出异常，开发人员可以立即发现并修复，而不必等到数小时甚至数天后在运行时才暴露。

**`@Lazy`的使用：**

| 使用位置 | 语义 | 作用 |
| --- | --- | --- |
| @Component @Lazy（类上） | 控制该 Bean 自身的初始化时机 | 推迟创建 |
| @Bean @Lazy（方法上） | 控制该 Bean 自身的初始化时机 | 推迟创建 |
| @Configuration @Lazy（类上） | 控制该配置类中所有 @Bean 的默认初始化时机 | 全局默认 |
| **注入点 @Lazy**（构造器参数/字段/Setter） | 控制该依赖的注入方式——注入代理而非真实实例 | 延迟解析依赖，解决循环依赖 |

> **陷阱说明：**
>
> 如果类上加了`@Lazy`，但被普通非懒加载类做构造器注入，**懒加载会失效，容器启动就创建对象**。 想要真正延迟，需要在**注入点参数上加`@Lazy`，生成代理**。

#### `@Primary`或`@Fallback `

`@Primary` 和 `@Fallback` 是 Spring 用于解决"同一类型存在多个 Bean 时自动装配选择歧义"的两种互补注解，前者标记"首选"候选者，后者标记"兜底"候选者，两者在语义上恰好相反

1. `@Primary` 的典型场景：默认实现

假设系统中存在一个 `PaymentService` 接口，有多个实现：`WeChatPay`、`Alipay`、`CreditCardPay`。其中 `WeChatPay` 是系统的主要支付方式，大多数业务场景都使用它。此时可以将 `WeChatPay` 标注为 `@Primary`，这样大多数组件无需额外配置即可自动注入，而少数需要特定支付方式的组件则通过 `@Qualifier` 精确指定。

2. `@Fallback` 的典型场景：模块化设计中的兜底实现

在模块化或可插拔架构中，核心库可以提供一个默认的 `@Fallback` 实现，而用户模块则可以提供自己的常规实现来自动覆盖它。例如，一个安全框架可以提供一个默认的 `@Fallback UserRepository`，当用户没有定义自己的 `UserRepository` 时，自动使用框架提供的默认实现；一旦用户定义了自定义实现，`@Fallback` 实现自动失效。这种机制无需用户显式配置排除或覆盖逻辑，实现了"约定优于配置"的设计理念。

#### `Qualifiers`限定符

1. **@Qualifier注解**

`@Qualifier` 是 Spring 提供的最细粒度的自动装配选择机制，允许开发者通过自定义的标识符在多个同类型 Bean 中精确指定注入目标。

***基本用法***：为 Bean 打标签，按标签注入

* 第一步：在 Bean 定义上标注限定符值（`@Qualifier("自定义Bean名称")`）
* 第二步：在注入点上使用相同的限定符值（`@Qualifier("自定义Bean名称")`）指定目标

>  Spring 在执行自动装配时，会先按类型筛选出所有`Bean`类型的候选者，然后通过 `@Qualifier("自定义Bean名称")` 进一步缩小范围，只选择标注了相同限定符值的 Bean。  

> `@Qualifier` 的标注位置非常灵活，不仅限于字段，还可以标注在构造器参数和方法参数上

***

2. **泛型限定符(隐式限定符)**

**无需使用`@Qualifier`，直接利用 Java 泛型参数本身作为限定符  。**

```java
public interface Store<T> {
    void save(T item);
    T find();
    // 其他业务方法
}
```

```java
@Configuration
public class MyConfiguration {

    @Bean
    public StringStore stringStore() {
        return new StringStore();  // 实现 Store<String>
    }

    @Bean
    public IntegerStore integerStore() {
        return new IntegerStore(); // 实现 Store<Integer>
    }
}
```

```java
@Autowired
private Store<String> s1;  // 泛型 <String> 隐式限定，注入 stringStore

@Autowired
private Store<Integer> s2; // 泛型 <Integer> 隐式限定，注入 integerStore
```

***

3. **自定义@Qualifier注解**

`@Qualifier` 最强大的能力在于：你可以基于它创建自定义的注解，从而为限定符赋予更丰富的语义和类型安全。

* 简单的自定义注解（无属性）

```java
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Qualifier
public @interface Offline {
}
```

使用时，只需在注入点和 Bean 定义上同时标注该注解即可

```java
@Autowired
@Offline
private MovieCatalog offlineCatalog;
```

* 带属性的自定义注解（多重筛选条件）

当需要更精细的筛选条件时，可以在自定义注解中定义多个属性：

```java
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Qualifier
public @interface MovieQualifier {
    String genre();
    Format format();
}
public enum Format {
    VHS, DVD, BLURAY
}
```

使用时，注入点需要同时指定所有属性值，且 Bean 定义必须匹配所有属性值才能被选中：

```java
@Autowired
@MovieQualifier(format = Format.VHS, genre = "Action")
private MovieCatalog actionVhsCatalog;

@Autowired
@MovieQualifier(format = Format.DVD, genre = "Action")
private MovieCatalog actionDvdCatalog;
```

### `@Bean` 和 `@Configuration`

* **`@Bean`** 用于声明一个工厂方法以注册 Bean；
* **`@Configuration`** 用于标记一个类为 Bean 定义来源；
* **两者组合使用**时（Full模式），Spring 通过 CGLIB 增强实现单例作用域的正确性；
* **`@Bean` 单独使用**（即 Lite 模式）时，则退化为普通工厂方法，不保证单例语义。

**Full 模式与 Lite 模式  ：**

| 维度 | **Full 模式**|**Lite 模式** |
| --- | --- | --- |
| **标注方式** | `@Configuration`类 | `@Component`类，或 `@Configuration(proxyBeanMethods = false)` |
| **CGLIB 代理** | 是，生成动态子类 | 否 |
| **`@Bean`方法间调用** | 被容器拦截，返回单例实例 | 普通 Java 调用，每次返回新实例 |
| **依赖表达方式** | 可通过方法调用或参数注入 | 应通过参数注入 |
| **运行时开销** | 有 CGLIB 增强开销 | 无额外开销 |
| **适用场景** | 需要跨 `@Bean`方法引用、需要 AOP 增强 | 简单工厂方法，无需跨方法引用 |

**实践建议：**

在绝大多数 Spring 应用场景中，尤其是 Spring Boot 项目中，`@Configuration` 类的 Full 模式是默认且推荐的选择。它提供了完整的容器生命周期管理、单例保证和 AOP 增强能力，代价是极小的 CGLIB 代理开销。

Lite 模式通常适用于以下场景：

* 需要将 `@Bean` 方法定义在 `@Component` 类中，以复用组件类的字段或状态
* 对启动性能有极致要求，需要避免 CGLIB 代理的开销
* `@Bean` 方法之间不存在相互调用，且不需要 AOP 增强

> 对于 `@Bean` 方法的访问修饰符，Full 模式要求方法必须可被覆盖（即不能声明为 `private` 或 `final`），因为 CGLIB 需要通过子类化来重写方法；而 Lite 模式则无此限制，可以自由声明为 `private`、`protected` 或 `public`。

### 方法注入

**方法注入(Lookup Method Injection)要解决的根本问题：生命周期不匹配，解决短命Bean被长命Bean注入的问题**

* 在大多数 Spring 应用中，Bean 的作用域默认是单例（singleton）。当一个**单例 Bean A**依赖于另一个**单例 Bean B**，标准的依赖注入方式完全够用——容器在创建 A 时将 B 注入，此后 A 和 B 的生命周期一致，不会出现异常。
* 但当 Bean 的**生命周期不同**时，问题就出现了。假设有一个单例的 `CommandManager`，它需要在每次调用 `process()` 方法时都获取一个**全新的**`Command` 实例（原型作用域），如果通过常规的构造器或 Setter 注入，Spring 只会在创建单例 `CommandManager` 时注入一次 `Command`，此后该 `CommandManager` 持有的 `Command` 实例将始终是同一个，无法满足"每次调用都获取新实例"的需求。

**解决方案：**

1. 不推荐的方案：容器感知

通过实现 `ApplicationContextAware` 接口获取容器引用，然后手动调用 `getBean()` 来获取新实例。

2. 推荐的方案：**方法注入**

**`@Lookup`注解**

在基于注解的配置中，使用 `@Lookup` 注解完成同样的功能：

```java
public abstract class CommandManager {

    public Object process(Object commandState) {
        Command command = createCommand();
        command.setState(commandState);
        return command.execute();
    }

    @Lookup("myCommand")
    protected abstract Command createCommand();
}
```

更简洁的方式是省略 `@Lookup` 的 value 属性，让 Spring 根据方法的返回类型自动匹配容器中的 Bean：

```java
@Lookup
protected abstract Command createCommand();
```

Spring 会通过反射获取 `createCommand()` 的返回类型 `Command`，然后在容器中查找该类型的 Bean 进行注入。

> **方法注入的约束条件**
>
> * **目标类和目标方法不能为 `final`**：Spring 通过 CGLIB 字节码生成技术，在运行时为目标类创建动态子类并重写被注入的方法。若目标类或方法声明为 `final`，CGLIB 无法生成子类或重写方法，导致方法注入失败
> * **抽象方法在单元测试中需手动提供桩实现**：若被注入的方法声明为 `abstract`，在脱离 Spring 容器的单元测试环境下，需自行创建子类并为该抽象方法提供桩实现（stub），否则无法编译或实例化
> * **不适用于工厂方法，尤其不适用于 `@Bean` 方法**：方法注入依赖容器在运行时创建并管理目标 Bean 的实例。在 `@Configuration` 类中通过 `@Bean` 方法注册 Bean 时，实例由开发者手动创建（`new` 语句），容器不参与实例的创建过程，因此无法为其生成运行时动态子类
> * **方法签名必须遵循固定格式**：标准格式为：`<public|protected> [abstract] <return-type> theMethodName(no-arguments);` 使用具体方法时（非abstract），类无需声明为 `abstract`，可以是一个普通的具体类，但 Spring 仍会通过 CGLIB 生成动态子类并覆盖该方法，原始方法体在容器环境中永远不会被执行。  

**方法注入与 `prototype`原型作用域**的区别：

* **原型作用域**：属于容器的 Bean 产出规则，每次调用`getBean()`返回全新实例；不会自动更新已经注入到成员字段的对象。单例 Bean 仅初始化时获取一次原型 Bean，后续会一直复用该实例，不会自动刷新。
* **方法注入（@Lookup）**：主动反复向容器索要 Bean 的机制，每次调用被注解标记的方法都会执行`getBean()`；返回实例由目标 Bean 自身作用域决定，不强制目标必须为原型，主要解决单例 Bean 依赖原型 Bean 时字段注入失效的问题。

## Bean 作用域

作用域就是决定"同一个配方会产出多少个实例，以及这些实例存活多久"的规则。

Spring 将对象实例的创建策略（单例、原型、按请求创建等）从 Java 类级别的硬编码中剥离出来，完全交由配置层面的作用域来控制。

* 配置作用域使用 **`@Scope("作用域名称")`** 注解；例：`@Scope("prototype")`。 
* 此外，还可以通过 `@ComponentScan` 的 `scopedProxy` 属性为所有扫描到的组件统一设置代理模式  

### '单例'与'原型'作用域

**Singleton（单例，默认）**：

* 每个 Spring IoC 容器中，每个 Bean 定义仅创建一个共享实例，所有请求返回同一对象。
* 适用于无状态 Bean（Service、DAO 等）。有状态的单例Bean有线程安全问题，需特殊处理。

> 注意与 GoF 单例模式的区别——GoF 是"每个 ClassLoader 每个类一个实例"，Spring 是"每个容器每个 Bean 定义一个实例"。

**Prototype（原型）**：

* 每次请求（注入或 `getBean()`）都创建新实例。
* 适用于有状态 Bean。

> 关键特性：Spring 不管理原型 Bean 的完整生命周期——初始化回调（`@PostConstruct`）仍执行，但销毁回调（`@PreDestroy`）不会执行，客户端需自行清理资源。Spring 在此角色上相当于 Java `new` 运算符的替代品。

**Singleton Bean 注入 Prototype Bean 的陷阱**

这是最容易被忽视的问题。单例 Bean 只创建一次，依赖注入也只发生一次，因此注入的原型 Bean 实际上'*退化为单例' ——永远都是最初创建的那个实例。如果你需要每次方法调用时获取新实例，有两种解决方案：

* _`@Lookup`_ 方法注入：通过 CGLIB 动态子类，每次方法调用时从容器获取新实例
* _`ObjectFactory<T>`_/ *`_ObjectProvider<T>_`* 注入：注入工厂对象，每次调用 `getObject()` 获取新实例，无需 AOP 代理

***

### 四种 Web 作用域

仅在 Web 感知的 `ApplicationContext` 中可用，需通过 `RequestContextListener` 或 `RequestContextFilter` 将 HTTP 请求对象绑定到当前线程（Spring MVC 的 `DispatcherServlet` 已自动处理）。

| 作用域 | 生命周期 | 注解 | 说明 |
| --- | --- | --- | --- |
| **request** | 单个 HTTP 请求 | `@RequestScope` | 每个请求独立实例，请求结束后丢弃 |
| **session** | 单个 HTTP Session | `@SessionScope` | 同一 Session 内共享，不同 Session 隔离 |
| **application** | 整个 `ServletContext` | `@ApplicationScope` | 每个 `ServletContext`
 一个实例，暴露为 Servlet 属性 |
| **websocket** | WebSocket 会话 | — | 适用于 STOMP over WebSocket 应用 |

***

**注意：**

1. **AOP 作用域代理**：解决不同作用域 Bean 的注入问题

当**短生命周期 Bean**（如 session 作用域）需要注入到**长生命周期 Bean**（如 singleton）时，直接注入会导致所有用户共享同一个实例。Spring 的方案是**注入 AOP 代理(proxyMode**)而非真实实例——代理在每次方法调用时从当前作用域（如 HTTP Session）获取真实实例并委托调用。

```java
@SessionScope(proxyMode = ScopedProxyMode.TARGET_CLASS)
@Component
public class UserPreferences { ... }
```

**代理类型**：默认使用 CGLIB 类代理（不拦截 `private` 方法），也可配置为 JDK 接口代理（要求目标类实现接口，调用方通过接口引用）。

***

2. **自定义作用域**

通过实现 `Scope` 接口（`get`、`remove`、`registerDestructionCallback`、`getConversationId` 四个方法），并通过编程方式（`beanFactory.registerScope`）或声明式方式（`CustomScopeConfigurer`）注册。Spring 内置 `SimpleThreadScope` 但默认未注册，可作为参考实现。

## 定制Bean特性

### Bean'出生'和'死亡'

1. **初始化回调 ——Bean 的 "出生后第一件事"**

容器完成全部依赖注入（`@Autowired`、`@Value`、`@Resource`等）之后执行，常用于依赖校验、建立连接、加载缓存等初始化工作。共 3 种实现方式：

* **方式一：@PostConstruct（官方推荐）**

```java
@Component
public class DatabaseService {
    private DataSource dataSource;

    @Autowired
    public void setDataSource(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @PostConstruct
    public void init() {
        // 所有依赖注入完成，可以安全使用dataSource
        if (dataSource == null) {
            throw new IllegalStateException("DataSource must not be null");
        }
    }
}
```

`@PostConstruct`属于 JSR‑250 标准，不绑定 SpringAPI，Bean 可脱离 Spring 环境复用。

* **方式二：InitializingBean 接口（不推荐）**

```java
@Component
public class DatabaseService implements InitializingBean {
    @Override
    public void afterPropertiesSet() {
        // 初始化逻辑，耦合Spring API
    }
}
```

缺点：业务代码与 Spring 强耦合。

* **方式三：自定义 init‑method（`@Bean` / XML）**

```java
@Bean(initMethod = "init")
public DatabaseService databaseService() {
    return new DatabaseService();
}
```

> 重要约束：`@PostConstruct`运行在**单例创建锁内部**，适合状态校验、构建内存数据结构；**不要在此获取其他 Bean、执行外部 IO 操作，会引发初始化死锁**。 昂贵的后置初始化逻辑，推荐使用：

2. **销毁回调 ——Bean 的 "死亡前的临终遗言"**

容器关闭时执行，用于释放数据库连接、线程池、文件句柄等资源；同样三种实现。

> 注意：原型 (prototype) Bean 不会触发销毁回调，Spring 不维护原型 Bean 实例引用，`@PreDestroy`、destroy 方法不会被容器自动调用，资源释放需要业务手动编码。

* **方式一：@PreDestroy（推荐）**

```java
@Component
public class DatabaseService {
    @PreDestroy
    public void cleanup() {
        // 释放资源、关闭连接池
    }
}
```

* **方式二：DisposableBean 接口（不推荐）**

```java
@Component
public class DatabaseService implements DisposableBean {
    @Override
    public void destroy() {
        // 销毁逻辑，耦合Spring API
    }
}
```

* **方式三：自定义 destroy‑method**

```java
@Bean(destroyMethod = "cleanup")
public DatabaseService databaseService() {
    return new DatabaseService();
}
```

Spring 自动推断：`@Bean`会自动检测`close()` / `shutdown()`公开方法；实现`AutoCloseable`/`Closeable`无需额外配置，自动调用`close()`。

> 同一个 Bean 同时配置多种初始化 / 销毁，执行顺序固定：
>
> * **初始化**：`@PostConstruct` → `afterPropertiesSet()`(InitializingBean) → 自定义`init‑method`
> * **销毁**：`@PreDestroy` → `destroy()`(DisposableBean) → 自定义`destroy‑method`

### 容器级'启动'和'关闭'

1. `Lifecycle`接口面向**容器整体启停**，适合后台任务、消息监听器、网络服务这类需要显式 start/stop 的组件。

```java
public interface Lifecycle {
    void start();
    void stop();
    boolean isRunning();
}
```

容器收到启停信号，由`LifecycleProcessor`协调，调用所有`Lifecycle`Bean 对应方法。

2. SmartLifecycle接口：Lifecycle的增强版，更精细控制

   继承`Lifecycle`，新增 3 项能力：

   * `isAutoStartup()`：容器刷新完成是否自动启动，不等待外部手动调用
   * `getPhase()`：启停优先级
     * 启动：phase越小越优先启动；*停止：phase越大越优先停止
     * 普通`Lifecycle`默认 phase=0；负数优先启动延后停止，正数延后启动优先停止
   * `stop(Runnable callback)`：支持异步停止，停止完成调用 callback 通知容器

### 容器感知接口（Aware）

| 接口 | 注入对象 | 用途 |
| --- | --- | --- |
| `ApplicationContextAware` | `ApplicationContext` | 获取容器，编程获取 Bean、发布事件、读取资源 |
| `BeanNameAware` | Bean 名称 (id/name) | 获取自身 bean 名称；执行时机：属性注入完成，初始化回调之前 |
| `ApplicationEventPublisherAware` | 事件发布器 | 发布应用事件 |
| `BeanClassLoaderAware` | 类加载器 | 获取加载 Bean 的 ClassLoader |
| `BeanFactoryAware` | `BeanFactory` | 底层 Bean 工厂 |
| `MessageSourceAware` | 消息源 | 国际化解析 |
| `ResourceLoaderAware` | 资源加载器 | 底层资源读取 |
| `ServletContextAware` | `ServletContext` | 仅 Web 环境 |
| `ServletConfigAware` | `ServletConfig` | 仅 Web 环境 |

## 容器扩展点

容器扩展点是 **Spring IoC 容器**预留的三个"插件接口"，允许开发者在无需继承或修改 Spring 源码的前提下，在容器生命周期的关键节点上插入自定义逻辑，分别作用于 Bean 实例（BeanPostProcessor）、Bean 定义元数据（BeanFactoryPostProcessor）和 Bean 创建逻辑（FactoryBean）

| 维度 | BeanPostProcessor | BeanFactoryPostProcessor | FactoryBean |
| --- | --- | --- | --- |
| **操作对象** | Bean 实例 | Bean 定义元数据 | Bean 创建逻辑 |
| **执行时机** | Bean 实例化后、初始化前后 | 所有 Bean 实例化之前 | Bean 实例化时 |
| **核心用途** | 修改/替换/代理 Bean 实例 | 修改配置、替换占位符 | 封装复杂创建逻辑 |
| **是否影响所有 Bean** | 是（对每个 Bean 生效） | 是（可修改所有 Bean 定义） | 否（仅影响自身） |
| **典型内置实现** | `AutowiredAnnotationBeanPostProcessor` | `PropertySourcesPlaceholderConfigurer` | `ProxyFactoryBean` |
| **注册要求** | 推荐 `static @Bean` | 推荐 `static @Bean` | 普通 Bean 定义即可 |
| **过早实例化风险** | 高（早期阶段 Bean 失去后处理能力） | 中 | 无 |

[容器扩展点官网描述跳转](https://docs.spring.io/spring-framework/reference/6.2/core/beans/factory-extension.html)

## 外部配置注入

**`@Value`** 是 Spring 用于将外部化配置值（如属性文件中的值、系统属性、环境变量等）注入到 Bean 字段或方法参数中的注解，支持占位符 `${...}`、SpEL 表达式 `#{...}`、默认值以及自动类型转换，是连接外部配置与内部代码的核心桥梁

| **能力** | 语法 | 说明 |
| --- | --- | --- |
| **占位符注入** | `${property.name}` | 从属性文件、环境变量、系统属性中读取值 |
| **默认值** | `${property.name:defaultValue}` | 配置缺失时使用默认值 |
| **SpEL 表达式** | `#{expression}` | 运行时动态计算值，支持复杂逻辑 |
| **自动类型转换** | 内置支持 | 字符串自动转换为 `int`、`String[]`、`Map`等类型 |
| **自定义转换器** | `ConversionService` | 通过注册自定义 `Converter`扩展类型转换能力 |

***

Spring 默认提供了一个**宽松的嵌入式值解析器**。宽松意味着：如果 `${catalog.name}` 无法解析，Spring 不会抛出异常，而是将 `${catalog.name}` 这个字符串本身作为值注入。这可能导致在运行时出现难以排查的 Bug。

如果希望**严格模式**——即任何占位符无法解析时容器初始化立即失败——需要显式声明 `PropertySourcesPlaceholderConfigurer`：

```java
@Configuration
public class AppConfig {
    @Bean
    public static PropertySourcesPlaceholderConfigurer propertyPlaceholderConfigurer() {
        return new PropertySourcesPlaceholderConfigurer();
    }
}
```

**注意**：`@Bean` 方法必须声明为 `static`。这是因为 `PropertySourcesPlaceholderConfigurer` 是一个 `BeanFactoryPostProcessor`，需要在容器早期阶段实例化。如果方法不是 `static` 的，会导致 `@Configuration` 类本身被提前初始化，从而引发与其他注解处理的生命周期冲突。

> **Spring Boot 的自动配置**：Spring Boot 默认配置了一个 `PropertySourcesPlaceholderConfigurer` Bean，它会从 `application.properties` 和 `application.yml` 文件中读取属性。因此，在使用 Spring Boot 的项目中，占位符的严格解析是默认行为，无需手动配置。

## `@Import` 配置类组合  

1. **`@Import`：配置模块化的入口**

在单一 `@Configuration` 类中声明所有 Bean 的做法在小规模项目中尚可接受，但随着项目规模的增长，将所有 Bean 定义集中在一个类中会导致配置类变得臃肿且难以维护。`@Import` 注解允许一个 `@Configuration` 类导入其他配置类，从而将配置按职责拆分为多个模块化的单元。

```java
@Configuration
public class ConfigA {
    @Bean
    public A a() { return new A(); }
}
@Configuration
@Import(ConfigA.class)
public class ConfigB {
    @Bean
    public B b() { return new B(); }
}
```

2. **跨配置类的依赖注入**

若Bean 之间的依赖关系跨越多个配置类。例如，`ServiceConfig` 中定义的 `TransferService` 依赖于 `RepositoryConfig` 中定义的 `AccountRepository`，而 `AccountRepository` 又依赖于 `SystemTestConfig` 中定义的 `DataSource`。Spring 为这种跨配置类的依赖提供了表达方式。

***推荐方式：方法参数注入***。`@Bean` 方法的参数会被 Spring 自动解析，无论该参数对应的 Bean 定义在哪个配置类中，容器都能正确识别并注入：

```java
@Configuration
public class ServiceConfig {
    @Bean
    public TransferService transferService(AccountRepository accountRepository) {
        return new TransferServiceImpl(accountRepository);
    }
}
@Configuration
public class RepositoryConfig {
    @Bean
    public AccountRepository accountRepository(DataSource dataSource) {
        return new JdbcAccountRepository(dataSource);
    }
}
@Configuration
@Import({ServiceConfig.class, RepositoryConfig.class})
public class SystemTestConfig {
    @Bean
    public DataSource dataSource() { return new DataSource(); }
}
```

## 类路径扫描

> spring boot项目启动类中的`@SpringBootApplication`注解已经包含`@ComponentScan`

类路径扫描（Classpath Scanning）是 Spring 从"显式注册 Bean"到"隐式发现 Bean"的关键转变，它通过扫描指定包路径下的类，自动识别标注了 `@Component` 及其派生注解的类，并将其注册为容器中的 Bean，从而彻底消除了 XML 配置文件中繁琐的 `<bean>` 声明

**启用类路径扫描：`@ComponentScan`**

 要启用类路径扫描，需要在 `@Configuration` 类上添加 `@ComponentScan` 注解，并指定要扫描的包路径：

```java
@Configuration
@ComponentScan(basePackages = "org.example")
public class AppConfig  {
    // ...
}
```

## 实例化Spring容器

> SpringBoot项目启动类中的`@SpringBootApplication`注解已经包含`@EnableAutoConfiguration：启用SpringBoot的自动配置机制`
>
> 因此，在 SpringBoot 项目中无需手动实例化Spring容器。SpringBoot在底层已经封装了这些操作。

[使用AnnotationConfigApplicationContext实例化Spring容器跳转](https://docs.spring.io/spring-framework/reference/6.2/core/beans/java/instantiating-container.html)

## 环境抽象

[环境抽象文档跳转](https://docs.spring.io/spring-framework/reference/6.2/core/beans/environment.html)

### 按环境条件化注册Bean

**`@Profile` 注解**

* `@Profile` 可以标注在 `@Configuration` 类级别，控制整个配置类是否生效。例如:`@Profile("dev")`
* `@Profile` 也可以标注在 `@Bean` 方法级别，实现在同一个 `@Configuration` 类中按 Profile 选择不同的 Bean 实现。例如:`@Profile("dev")`

`Profile` 字符串支持逻辑运算符，用于表达更复杂的条件（混用需要加括号）：

* `!`：逻辑非，例如 `@Profile("!pro")` 表示非生产环境
* `&`：逻辑与，例如 `@Profile("pro & us-east")` 表示生产环境且位于美东区域
* `|`：逻辑或，例如 `@Profile("pro | staging")` 表示生产或预发布环境

**激活`Profile`**

> 编程式 API > JVM 系统属性 > 系统环境变量 > Servlet 上下文参数  > 外部yaml > 内部yaml

* 编程式API：代码应写在 `ApplicationContext` 实例化之后、`refresh()` 方法调用之前
* JVM系统属性：`java -Dspring.profiles.active="production" -jar myapp.jar`
* 系统环境变量：Linux：`exportspring_profiles_active=production`
* Servlet上下文参数：`web.xml`中配置
* yaml配置： spring.profiles.active=dev  

> _注意：_
>
> `spring.profiles.active` 写在_application.yml_里生效；
>
> 写在 *application-dev.yml* 里面不生效，因为加载顺序问题，子环境配置文件加载的时候，profile 激活判断已经走完了。

### 层次化的属性源体系

属性源(`PropertySource`) 是对任何键值对来源的简单抽象。Spring 的 `StandardEnvironment` 默认配置了两个 `PropertySource`：一个代表 JVM 系统属性（`System.getProperties()`），一个代表系统环境变量（`System.getenv()`）。

属性源的搜索是层次化的，优先级高的属性源中的值会覆盖优先级低的属性源中的同名值。对于 `StandardServletEnvironment`，完整的优先级顺序如下（从高到低）：

1. ServletConfig 参数（`DispatcherServlet` 上下文）
2. ServletContext 参数（`web.xml` 中的 `context-param`）
3. JNDI 环境变量（`java:comp/env/` 条目）
4. JVM 系统属性（`-D` 命令行参数）
5. JVM 系统环境变量（操作系统环境变量）

## 加载时编织器

`LoadTimeWeaver`（加载时编织器）是 Spring 提供的一种机制，允许在 JVM 加载类的字节码时对其进行动态修改（即"编织"），主要用于在不修改源码的情况下为类添加额外行为——例如 JPA 的懒加载代理、AspectJ 的切面增强等。通过 `@EnableLoadTimeWeaving` 注解即可启用，且无需在类路径中额外添加 CGLIB 库。

[加载时编织器文档跳转](https://docs.spring.io/spring-framework/reference/6.2/core/beans/context-load-time-weaver.html)

## ApplicationContext 功能

`ApplicationContext` 在 `BeanFactory` 的基础之上，额外提供了四大核心能力

* 国际化消息解析（MessageSource）
* 事件发布与监听（ApplicationEvent/ApplicationListener）
* 底层资源访问（ResourceLoader）
* 应用启动追踪（ApplicationStartup）

[ApplicationContext功能文档跳转](https://docs.spring.io/spring-framework/reference/6.2/core/beans/context-introduction.html)
