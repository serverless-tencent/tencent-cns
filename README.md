# 腾讯云云解析组件

&nbsp;

## 简介

该组件是 云解析 组件，可以通过该组件，使用腾讯云云解析相关业务。

## 快速开始

通过该组件，对一个函数进行多地域创建，配置，部署和删除等操作。支持命令如下：

1. [安装](#1-安装)
2. [配置](#2-配置)
3. [部署](#3-部署)
4. [移除](#4-移除)

### 1. 安装

通过 npm 安装 serverless

```console
$ npm install -g serverless
```

### 2. 配置

本地创建 `serverless.yml` 文件，在其中进行如下配置

```console
$ touch serverless.yml
```

```yml
# serverless.yml

cnsResolution:
  component: '@serverless/tencent-cns'
  inputs:
    domain: anycodes.cn
    records:
      - subDomain: abc
        recordType: CNAME
        recordLine: 默认
        value: cname.dnspod.com.
        ttl: 600
        mx: 10
        status: enable
      - subDomain: def
        recordType: CNAME
        recordLine: 默认
        value: cname.dnspod.com.
        ttl: 600
        mx: 10
        status: enable

```

### 3. 部署

如您的账号未[登陆](https://cloud.tencent.com/login)或[注册](https://cloud.tencent.com/register)腾讯云，您可以直接通过`微信`扫描命令行中的二维码进行授权登陆和注册。

通过`sls`命令进行部署，并可以添加`--debug`参数查看部署过程中的信息

```
$ sls --debug
  
  DEBUG ─ Resolving the template's static variables.
  DEBUG ─ Collecting components from the template.
  DEBUG ─ Downloading any NPM components found in the template.
  DEBUG ─ Analyzing the template's components dependencies.
  DEBUG ─ Creating the template's components graph.
  DEBUG ─ Syncing template state.
  DEBUG ─ Executing the template's components graph.
  DEBUG ─ Getting release domain records ... 
  DEBUG ─ Get release domain error.
  DEBUG ─ Adding domain ...
  DEBUG ─ Added domain
  DEBUG ─ Doing action about domain records ... 
  DEBUG ─ Resolving abc - cname.dnspod.com.
  DEBUG ─ Creating ... 
  DEBUG ─ Created (recordId is 555093860) 
  DEBUG ─ Modifying status to enable 
  DEBUG ─ Modified status to enable 
  DEBUG ─ Resolving def - cname.dnspod.com.
  DEBUG ─ Creating ... 
  DEBUG ─ Created (recordId is 555093864) 
  DEBUG ─ Modifying status to enable 
  DEBUG ─ Modified status to enable 

  cnsResolution: 
    domain:  anycodes.cn
    records: 
      - 
        subDomain:  abc
        recordType: CNAME
        recordLine: 默认
        value:      cname.dnspod.com.
        status:     enable
      - 
        subDomain:  def
        recordType: CNAME
        recordLine: 默认
        value:      cname.dnspod.com.
        status:     enable
    DNS:     Please set your domain DNS: f1g1ns1.dnspod.net | f1g1ns1.dnspod.net

  6s › cnsResolution › done


```

### 4. 移除

通过以下命令移除

```
$ sls remove --debug

  DEBUG ─ Flushing template state and removing all components.
  DEBUG ─ Removing ...
  DEBUG ─ Removing record abc 555093860 
  DEBUG ─ Removed record abc 555093860 
  DEBUG ─ Removing record def 555093864 
  DEBUG ─ Removed record def 555093864 
  DEBUG ─ Removed ...

  4s › cnsResolution › done

```

#### 账号配置（可选）

当前默认支持 CLI 扫描二维码登录，如您希望配置持久的环境变量/秘钥信息，也可以本地创建 `.env` 文件

```console
$ touch .env # 腾讯云的配置信息
```

在 `.env` 文件中配置腾讯云的 SecretId 和 SecretKey 信息并保存。

```
# .env
TENCENT_SECRET_ID=123
TENCENT_SECRET_KEY=123
```

> ?
>
> - 如果没有腾讯云账号，请先 [注册新账号](https://cloud.tencent.com/register)。
> - 如果已有腾讯云账号，可以在 [API 密钥管理
>   ](https://console.cloud.tencent.com/cam/capi) 中获取 SecretId 和 SecretKey。

### 还支持哪些组件？

可以在 [Serverless Components](https://github.com/serverless/components) repo 中查询更多组件的信息。
