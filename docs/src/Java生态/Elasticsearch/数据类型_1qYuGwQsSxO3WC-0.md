## 数据类型

## 数据类型
### 字符串类型
#### text

用于全文文本数据。

+ 支持**分词**和**全文检索**；
+ 但不适合排序和聚合操作

#### keyword

用于结构化文本。

+ 不进行分词
+ 适合精确匹配、排序和聚合

### 数值类型

+ long、integer、short、byte：不同范围的整数类型
+ double、float：浮点数类型，用于存储小数
+ scaled_float：通过缩放因子将浮点数转为整数存储，兼顾精度和性能

### 日期类型

+ date：存储日期或日期时间信息，支持多种格式

### 布尔类型

+ boolean：存储 true 或 false 值

### 二进制类型

+ binary：存储二进制数据

### 复杂类型

+ object：嵌套文档结构，文档内可包含子文档
+ nested：特殊的对象类型，用于存储数组，数组中每个元素都是独立可搜索的文档

## 与MySQL的类型映射

在实际业务中，经常需要将 MySQL 数据同步到 Elasticsearch，了解两者的类型映射关系非常重要：

| MySQL 类型 | Elasticsearch 类型 | 说明 |
| --- | --- | --- |
| VARCHAR | text 或 keyword | 需全文搜索用 text，精确匹配用 keyword |
| CHAR | keyword | 固定长度字符串，通常用 keyword |
| BLOB/TEXT | text | 大文本内容使用 text，支持全文检索 |
| INT、BIGINT | long | 整数类型统一映射为 long，支持更大数值范围 |
| TINYINT | byte | 小整数可映射为 byte 类型 |
| DECIMAL、FLOAT、DOUBLE | double 或 float | 根据精度需求选择，或使用 scaled_float |
| DATE、DATETIME、TIMESTAMP | date | 所有日期时间类型统一映射为 date |
| TINYINT(1) | boolean | MySQL 中常用 TINYINT (1) 表示布尔值 |
