## <font style="color:rgb(51, 51, 51);">附录：HTTP状态信息</font>
### <font style="color:rgb(51, 51, 51);">1xx: 信息</font>
| **<font style="color:rgb(51, 51, 51);">消息</font>** | **<font style="color:rgb(51, 51, 51);">描述</font>** |
| --- | --- |
| <font style="color:rgb(51, 51, 51);">100 Continue</font> | <font style="color:rgb(51, 51, 51);">服务器仅接收到部分请求，但是一旦服务器并没有拒绝该请求，客户端应该继续发送其余的请求。</font> |
| <font style="color:rgb(51, 51, 51);">101 Switching Protocols</font> | <font style="color:rgb(51, 51, 51);">服务器转换协议：服务器将遵从客户的请求转换到另外一种协议。</font> |


### <font style="color:rgb(51, 51, 51);">2xx: 成功</font>
| **<font style="color:rgb(51, 51, 51);">消息</font>** | **<font style="color:rgb(51, 51, 51);">描述</font>** |
| --- | --- |
| <font style="color:rgb(51, 51, 51);">200 OK</font> | <font style="color:rgb(51, 51, 51);">请求成功（其后是对GET和POST请求的应答文档。）</font> |
| <font style="color:rgb(51, 51, 51);">201 Created</font> | <font style="color:rgb(51, 51, 51);">请求被创建完成，同时新的资源被创建。</font> |
| <font style="color:rgb(51, 51, 51);">202 Accepted</font> | <font style="color:rgb(51, 51, 51);">供处理的请求已被接受，但是处理未完成。</font> |
| <font style="color:rgb(51, 51, 51);">203 Non-authoritative Information</font> | <font style="color:rgb(51, 51, 51);">文档已经正常地返回，但一些应答头可能不正确，因为使用的是文档的拷贝。</font> |
| <font style="color:rgb(51, 51, 51);">204 No Content</font> | <font style="color:rgb(51, 51, 51);">没有新文档。浏览器应该继续显示原来的文档。如果用户定期地刷新页面，而Servlet可以确定用户文档足够新，这个状态代码是很有用的。</font> |
| <font style="color:rgb(51, 51, 51);">205 Reset Content</font> | <font style="color:rgb(51, 51, 51);">没有新文档。但浏览器应该重置它所显示的内容。用来强制浏览器清除表单输入内容。</font> |
| <font style="color:rgb(51, 51, 51);">206 Partial Content</font> | <font style="color:rgb(51, 51, 51);">客户发送了一个带有Range头的GET请求，服务器完成了它。</font> |


### <font style="color:rgb(51, 51, 51);">3xx: 重定向</font>
| **<font style="color:rgb(51, 51, 51);">消息</font>** | **<font style="color:rgb(51, 51, 51);">描述</font>** |
| --- | --- |
| <font style="color:rgb(51, 51, 51);">300 Multiple Choices</font> | <font style="color:rgb(51, 51, 51);">多重选择。链接列表。用户可以选择某链接到达目的地。最多允许五个地址。</font> |
| <font style="color:rgb(51, 51, 51);">301 Moved Permanently</font> | <font style="color:rgb(51, 51, 51);">所请求的页面已经转移至新的url。</font> |
| <font style="color:rgb(51, 51, 51);">302 Found</font> | <font style="color:rgb(51, 51, 51);">所请求的页面已经临时转移至新的url。</font> |
| <font style="color:rgb(51, 51, 51);">303 See Other</font> | <font style="color:rgb(51, 51, 51);">所请求的页面可在别的url下被找到。</font> |
| <font style="color:rgb(51, 51, 51);">304 Not Modified</font> | <font style="color:rgb(51, 51, 51);">未按预期修改文档。客户端有缓冲的文档并发出了一个条件性的请求（一般是提供If-Modified-Since头表示客户只想比指定日期更新的文档）。服务器告诉客户，原来缓冲的文档还可以继续使用。</font> |
| <font style="color:rgb(51, 51, 51);">305 Use Proxy</font> | <font style="color:rgb(51, 51, 51);">客户请求的文档应该通过Location头所指明的代理服务器提取。</font> |
| <font style="color:rgb(51, 51, 51);">306 </font>_<font style="color:rgb(51, 51, 51);">Unused</font>_ | <font style="color:rgb(51, 51, 51);">此代码被用于前一版本。目前已不再使用，但是代码依然被保留。</font> |
| <font style="color:rgb(51, 51, 51);">307 Temporary Redirect</font> | <font style="color:rgb(51, 51, 51);">被请求的页面已经临时移至新的url。</font> |


### <font style="color:rgb(51, 51, 51);">4xx: 客户端错误</font>
| **<font style="color:rgb(51, 51, 51);">消息</font>** | **<font style="color:rgb(51, 51, 51);">描述</font>** |
| --- | --- |
| <font style="color:rgb(51, 51, 51);">400 Bad Request</font> | <font style="color:rgb(51, 51, 51);">服务器未能理解请求。</font> |
| <font style="color:rgb(51, 51, 51);">401 Unauthorized</font> | <font style="color:rgb(51, 51, 51);">被请求的页面需要用户名和密码。</font> |
| <font style="color:rgb(51, 51, 51);">402 Payment Required</font> | <font style="color:rgb(51, 51, 51);">此代码尚无法使用。</font> |
| <font style="color:rgb(51, 51, 51);">403 Forbidden</font> | <font style="color:rgb(51, 51, 51);">对被请求页面的访问被禁止。</font> |
| <font style="color:rgb(51, 51, 51);">404 Not Found</font> | <font style="color:rgb(51, 51, 51);">服务器无法找到被请求的页面。</font> |
| <font style="color:rgb(51, 51, 51);">405 Method Not Allowed</font> | <font style="color:rgb(51, 51, 51);">请求中指定的方法不被允许。</font> |
| <font style="color:rgb(51, 51, 51);">406 Not Acceptable</font> | <font style="color:rgb(51, 51, 51);">服务器生成的响应无法被客户端所接受。</font> |
| <font style="color:rgb(51, 51, 51);">407 Proxy Authentication Required</font> | <font style="color:rgb(51, 51, 51);">用户必须首先使用代理服务器进行验证，这样请求才会被处理。</font> |
| <font style="color:rgb(51, 51, 51);">408 Request Timeout</font> | <font style="color:rgb(51, 51, 51);">请求超出了服务器的等待时间。</font> |
| <font style="color:rgb(51, 51, 51);">409 Conflict</font> | <font style="color:rgb(51, 51, 51);">由于冲突，请求无法被完成。</font> |
| <font style="color:rgb(51, 51, 51);">410 Gone</font> | <font style="color:rgb(51, 51, 51);">被请求的页面不可用。</font> |
| <font style="color:rgb(51, 51, 51);">411 Length Required</font> | <font style="color:rgb(51, 51, 51);">"Content-Length" 未被定义。如果无此内容，服务器不会接受请求。</font> |
| <font style="color:rgb(51, 51, 51);">412 Precondition Failed</font> | <font style="color:rgb(51, 51, 51);">请求中的前提条件被服务器评估为失败。</font> |
| <font style="color:rgb(51, 51, 51);">413 Request Entity Too Large</font> | <font style="color:rgb(51, 51, 51);">由于所请求的实体的太大，服务器不会接受请求。</font> |
| <font style="color:rgb(51, 51, 51);">414 Request-url Too Long</font> | <font style="color:rgb(51, 51, 51);">由于url太长，服务器不会接受请求。当post请求被转换为带有很长的查询信息的get请求时，就会发生这种情况。</font> |
| <font style="color:rgb(51, 51, 51);">415 Unsupported Media Type</font> | <font style="color:rgb(51, 51, 51);">由于媒介类型不被支持，服务器不会接受请求。</font> |
| <font style="color:rgb(51, 51, 51);">416 </font> | <font style="color:rgb(51, 51, 51);">服务器不能满足客户在请求中指定的Range头。</font> |
| <font style="color:rgb(51, 51, 51);">417 Expectation Failed</font> |  |


### <font style="color:rgb(51, 51, 51);">5xx: 服务器错误</font>
| **<font style="color:rgb(51, 51, 51);">消息</font>** | **<font style="color:rgb(51, 51, 51);">描述</font>** |
| --- | --- |
| <font style="color:rgb(51, 51, 51);">500 Internal Server Error</font> | <font style="color:rgb(51, 51, 51);">请求未完成。服务器遇到不可预知的情况。</font> |
| <font style="color:rgb(51, 51, 51);">501 Not Implemented</font> | <font style="color:rgb(51, 51, 51);">请求未完成。服务器不支持所请求的功能。</font> |
| <font style="color:rgb(51, 51, 51);">502 Bad Gateway</font> | <font style="color:rgb(51, 51, 51);">请求未完成。服务器从上游服务器收到一个无效的响应。</font> |
| <font style="color:rgb(51, 51, 51);">503 Service Unavailable</font> | <font style="color:rgb(51, 51, 51);">请求未完成。服务器临时过载或当机。</font> |
| <font style="color:rgb(51, 51, 51);">504 Gateway Timeout</font> | <font style="color:rgb(51, 51, 51);">网关超时。</font> |
| <font style="color:rgb(51, 51, 51);">505 HTTP Version Not Supported</font> | <font style="color:rgb(51, 51, 51);">服务器不支持请求中指明的HTTP协议版本。</font> |


