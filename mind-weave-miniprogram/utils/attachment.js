const { getBase } = require('../config')

// 下载带鉴权的附件到本地临时文件（图片/视频预览用）
const cache = {}

function downloadAttachment(id) {
  return new Promise((resolve, reject) => {
    if (cache[id]) return resolve(cache[id])
    const token = wx.getStorageSync('salary_token')
    const doDownload = (withAuth) => {
      wx.downloadFile({
        url: getBase() + `/tool/attachments/${id}/content`,
        header: withAuth && token ? { Authorization: `Bearer ${token}` } : {},
        success(res) {
          if (res.statusCode === 200) {
            cache[id] = res.tempFilePath
            resolve(res.tempFilePath)
          } else if (withAuth) {
            // 文章类附件已公开，去掉鉴权重试一次
            doDownload(false)
          } else {
            reject(new Error('附件下载失败'))
          }
        },
        fail: (err) => {
          if (withAuth) doDownload(false)
          else reject(err)
        }
      })
    }
    doDownload(true)
  })
}

function collectAttachmentIds(md) {
  const ids = []
  const re = /attachment:(\d+)/g
  let m
  while ((m = re.exec(String(md || '')))) ids.push(m[1])
  return [...new Set(ids)]
}

module.exports = { downloadAttachment, collectAttachmentIds }
