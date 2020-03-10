const { Component } = require('@serverless/core')
const Capi = require('qcloudapi-sdk')
const tencentAuth = require('serverless-tencent-auth-tool')

// Create a new component by extending the Component Class
function HttpError(code, message) {
  this.code = code || 0
  this.message = message || ''
}
HttpError.prototype = Error.prototype

class TencentSCFMultiRegion extends Component {
  async doAction(apig, action, inputs) {
    return new Promise((resolve, reject) => {
      apig.request(
        {
          Action: action,
          RequestClient: 'ServerlessComponent',
          Token: apig.defaults.Token || null,
          ...inputs
        },
        function(err, data) {
          if (err) {
            return reject(err)
          } else if (data.code !== 0) {
            return reject(new HttpError(data.code, data.message))
          }
          resolve(data.data)
        }
      )
    })
  }

  haveRecord(newRecord, historyRcords) {
    for (let i = 0; i < historyRcords.length; i++) {
      if (
        newRecord.domain == historyRcords[i].domain &&
        newRecord.subDomain == historyRcords[i].subDomain &&
        newRecord.recordType == historyRcords[i].recordType &&
        newRecord.value == historyRcords[i].value
      ) {
        return historyRcords[i]
      }
    }
    return false
  }

  deleteRecord(newRecords, historyRcords) {
    const deleteList = []
    for (let i = 0; i < historyRcords.length; i++) {
      let temp = false
      for (let j = 0; j < newRecords.length; j++) {
        if (
          newRecords[j].domain == historyRcords[i].domain &&
          newRecords[j].subDomain == historyRcords[i].subDomain &&
          newRecords[j].recordType == historyRcords[i].recordType &&
          newRecords[j].value == historyRcords[i].value
        ) {
          temp = true
          break
        }
      }
      if (!temp) {
        deleteList.push(historyRcords[i])
      }
    }
    return deleteList
  }

  async default(inputs = {}) {
    // login
    const auth = new tencentAuth()
    this.context.credentials.tencent = await auth.doAuth(this.context.credentials.tencent, {
      client: 'tencent-apigateway',
      remark: inputs.fromClientRemark,
      project: this.context.instance ? this.context.instance.id : undefined,
      action: 'default'
    })

    const apig = new Capi({
      SecretId: this.context.credentials.tencent.SecretId,
      SecretKey: this.context.credentials.tencent.SecretKey,
      serviceType: 'cns',
      Token: this.context.credentials.tencent.token
    })

    const output = {
      domain: inputs.domain,
      records: []
    }
    const recordList = []
    const recordHistory = this.state || []
    const recordRelease = []
    let domainLength = 100
    let offset = 0

    this.context.debug(`Getting release domain records ... `)
    try {
      while (domainLength == 100) {
        const statusInputs = {
          offset: offset,
          length: domainLength,
          domain: inputs.domain
        }
        const recordReleaseList = await this.doAction(apig, 'RecordList', statusInputs)
        if (recordReleaseList.codeDesc == 'Success') {
          for (let i = 0; i < recordReleaseList['data']['records'].length; i++) {
            recordRelease.push({
              domain: inputs.domain,
              subDomain: recordReleaseList['data']['records'][i].name,
              recordType: recordReleaseList['data']['records'][i].type,
              value: recordReleaseList['data']['records'][i].value,
              recordId: recordReleaseList['data']['records'][i].id
            })
          }
          domainLength = recordReleaseList['data']['records'].length
        } else {
          domainLength = 0
        }
        offset = offset + 1
      }
      this.context.debug(`Getted release domain.`)
    } catch (e) {
      try {
        this.context.debug(`Get release domain error.`)
        this.context.debug(`Adding domain ...`)
        await this.doAction(apig, 'DomainCreate', {
          domain: inputs.domain
        })
        output.DNS = 'Please set your domain DNS: f1g1ns1.dnspod.net | f1g1ns1.dnspod.net'
        this.context.debug(`Added domain`)
      } catch (e) {
        this.context.debug(`Add domain error`)
        this.context.debug(`Trying to deploy ...`)
      }
    }

    // 增加/修改记录
    this.context.debug(`Doing action about domain records ... `)
    for (let recordNum = 0; recordNum < inputs.records.length; recordNum++) {
      const tempInputs = JSON.parse(JSON.stringify(inputs.records[recordNum]))
      tempInputs.domain = inputs.domain
      if (!tempInputs.status) {
        tempInputs.status = 'enable' // 设置默认值
      }

      this.context.debug(`Resolving ${tempInputs.subDomain} - ${tempInputs.value}`)

      const tempHistory = this.haveRecord(tempInputs, recordHistory)
      const releseHistory = this.haveRecord(tempInputs, recordRelease)
      if (tempHistory || tempInputs.recordId || releseHistory) {
        // 修改
        if (!tempInputs.recordId) {
          tempInputs.recordId = tempHistory.recordId ? tempHistory.recordId : releseHistory.recordId
        }
        this.context.debug(`Modifying (recordId is ${tempInputs.recordId})... `)
        await this.doAction(apig, 'RecordModify', tempInputs)
        this.context.debug(`Modified (recordId is ${tempInputs.recordId}) `)
      } else {
        // 新建
        this.context.debug(`Creating ... `)
        const createOutputs = await this.doAction(apig, 'RecordCreate', tempInputs)
        tempInputs.recordId = createOutputs.record.id
        this.context.debug(`Created (recordId is ${tempInputs.recordId}) `)
      }
      recordList.push(tempInputs)
      output.records.push({
        subDomain: tempInputs.subDomain,
        recordType: tempInputs.recordType,
        recordLine: tempInputs.recordLine,
        value: tempInputs.value,
        status: tempInputs.status
      })
      // 改状态
      this.context.debug(`Modifying status to ${tempInputs.status} `)
      const statusInputs = {
        domain: inputs.domain,
        recordId: tempInputs.recordId,
        status: tempInputs.status
      }
      await this.doAction(apig, 'RecordStatus', statusInputs)
      this.context.debug(`Modified status to ${tempInputs.status} `)
    }

    // 删除serverless创建的但是不在本次列表中
    const delList = this.deleteRecord(recordList, recordHistory)
    if (delList.length > 0) {
      this.context.debug(
        `Deleting records which deployed by this project, but not in this records list. `
      )
      for (let recordNum = 0; recordNum < delList.length; recordNum++) {
        this.context.debug(
          `Deleting record ${delList[recordNum].subDomain} ${delList[recordNum].recordId} `
        )
        const statusInputs = {
          domain: delList[recordNum].domain,
          recordId: delList[recordNum].recordId
        }
        await this.doAction(apig, 'RecordDelete', statusInputs)
        this.context.debug(
          `Deleted record ${delList[recordNum].subDomain} ${delList[recordNum].recordId} `
        )
      }
      this.context.debug(
        `Deleted records which deployed by this project, but not in this records list. `
      )
    }

    this.state = recordList
    await this.save()

    return output
  }

  async remove(inputs = {}) {
    this.context.debug(`Removing ...`)

    // login
    const auth = new tencentAuth()
    this.context.credentials.tencent = await auth.doAuth(this.context.credentials.tencent, {
      client: 'tencent-apigateway',
      remark: inputs.fromClientRemark,
      project: this.context.instance ? this.context.instance.id : undefined,
      action: 'default'
    })

    const apig = new Capi({
      SecretId: this.context.credentials.tencent.SecretId,
      SecretKey: this.context.credentials.tencent.SecretKey,
      serviceType: 'cns',
      Token: this.context.credentials.tencent.token
    })

    const recordHistory = this.state || []
    for (let recordNum = 0; recordNum < recordHistory.length; recordNum++) {
      this.context.debug(
        `Removing record ${recordHistory[recordNum].subDomain} ${recordHistory[recordNum].recordId} `
      )
      const statusInputs = {
        domain: recordHistory[recordNum].domain,
        recordId: recordHistory[recordNum].recordId
      }
      await this.doAction(apig, 'RecordDelete', statusInputs)
      this.context.debug(
        `Removed record ${recordHistory[recordNum].subDomain} ${recordHistory[recordNum].recordId} `
      )
    }

    this.context.debug(`Removed ...`)

    // after removal we clear the state to keep it in sync with the service API
    // this way if the user tried to deploy again, there would be nothing to remove
    this.state = {}
    await this.save()

    // might be helpful to output the Bucket that was removed
    return {}
  }
}

// don't forget to export the new Componnet you created!
module.exports = TencentSCFMultiRegion
