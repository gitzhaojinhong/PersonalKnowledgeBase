## MinIO

## MinIO 核心概念

兼容 Amazon S3 API

| 概念 | 含义 |
| --- | --- |
| Object（对象） | 存储的基本单位，例如文件、图片等。对象由数据和元数据组成，可以是任意类型的数据 |
| Bucket（桶） | 用于组织对象的逻辑空间，相互之间隔离，类似于文件系统中的顶层文件夹。每个桶可以容纳任意数量的对象 |
| Drive（驱动磁盘） | 存储数据的磁盘，所有对象数据都存储在 Drive 中，启动时通过参数传入 |
| Set（磁盘集） | 一组 Drive 的集合，分布式部署时根据集群规模自动划分一个或多个 Set |
| Access Key / Secret Key | 访问密钥，用于客户端连接 MinIO 服务的身份认证 |

[MinIO官方文档](https://docs.min.io/aistor/developers/)

[Java SDK API参考](https://docs.min.io/aistor/developers/sdk/java/api/)

## 完整示例

#### 添加依赖

在 `pom.xml` 中引入 MinIO Java SDK 依赖（Spring Boot 3 建议使用 8.5.17 及以上版本）：

```xml
<dependency>
  <groupId>io.minio</groupId>
  <artifactId>minio</artifactId>
  <version>8.5.17</version>
</dependency>
```

#### 配置连接参数

在 `application.yml` 中添加 MinIO 连接信息：

```yaml
minio:
  endpoint: http://127.0.0.1:9000
  accessKey: YOUR_ACCESS_KEY
  secretKey: YOUR_SECRET_KEY
  bucketName: your-bucket-name
```

其中 `accessKey`、`secretKey` 和 `bucket` 可以在 MinIO Web 控制台（默认端口 9001）中创建和获取。

#### 创建配置类，注入 MinioClient

创建一个配置类，将 MinioClient 注入到 Spring 容器中：

```java
@Configuration
public class MinioConfig {
    @Value("${minio.endpoint}")
    private String endpoint;
    @Value("${minio.accessKey}")
    private String accessKey;
    @Value("${minio.secretKey}")
    private String secretKey;
    @Value("${minio.bucketName}")
    private String bucketName;

    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
        .endpoint(endpoint)
        .credentials(accessKey, secretKey)
        .build();
    }
    // 初始化桶
    @Bean
    public CommandLineRunner minioBucketInitializer(MinioClient minioClient) {
        return args -> {
            try {
                // 判断桶是否存在
                boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build());
                if (!exists) {
                    // 创建桶
                    minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());
                    log.info("文档管理模块 MinIO bucket 不存在，已自动创建，bucket={}", bucketName);
                }
                else {
                    log.info("文档管理模块 MinIO bucket 已存在，bucket={}", bucketName);
                }
            }
            catch (Exception exception) {
                throw new SuperAgentFrameException(ManageCode.STORAGE_FAILED.getCode(),
                    "初始化 MinIO bucket 失败: " + exception.getMessage(), exception);
            }
        };
    }
}
```

#### 编写服务类，实现文件上传与下载

创建一个服务类封装核心操作：

```java
@Service
public class MinioService {
    @Autowired
    private MinioClient minioClient;
    @Value("${minio.bucketName}")
    private String bucketName;

    // 上传文件
    public void uploadFile(String objectName, InputStream inputStream, long size) throws Exception {
        minioClient.putObject(
            PutObjectArgs.builder()
            .bucket(bucketName)
            .object(objectName)
            .stream(inputStream, size, -1)
            .contentType("image/png")  // 设置系统元数据 Content-Type
            .userMetadata(userMetadata)  // 设置自定义元数据
            .build()
        );
    }

    // 下载文件 注意关闭输入流
    public InputStream downloadFile(String objectName) throws Exception {
        return minioClient.getObject(
            GetObjectArgs.builder()
            .bucket(bucketName)
            .object(objectName)
            .build()
        );
    }
    // 获取对象的元数据
    public StatObjectResponse statObject(String objectName) throws Exception {
        return minioClient.statObject(
            StatObjectArgs.builder()
                .bucket(bucketName)
                .object(objectName)
                .build()
        );
    }
    // 删除单个对象
    public void removeObject(String objectName) throws Exception {
        minioClient.removeObject(
            RemoveObjectArgs.builder()
                .bucket(bucketName)
                .object(objectName)
                .build()
        );
    }
}
```

#### 在 Controller 中调用

```java
@RestController
@RequestMapping("/file")
public class FileController {
    @Autowired
    private MinioService minioService;

    @PostMapping("/upload")
    public String upload(@RequestParam("file") MultipartFile file) throws Exception {
        minioService.uploadFile(
            file.getOriginalFilename(),
            file.getInputStream(),
            file.getSize()
        );
        return "上传成功";
    }

    @GetMapping("/download/{objectName}")
    public void download(@PathVariable String objectName) throws Exception {
        InputStream stream = minioService.downloadFile(objectName);
        // 将流读取为byte数组，或执行其他操作
        byte[] b = stream.readAllBytes();
    }
}
```
