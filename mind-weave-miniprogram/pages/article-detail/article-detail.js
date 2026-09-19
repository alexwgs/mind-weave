const { get } = require('../../utils/request')
const { renderMarkdownMp } = require('../../utils/markdown-mp')
const { downloadAttachment, collectAttachmentIds } = require('../../utils/attachment')

Page({
  data: {
    id: null,
    isPublic: false,
    article: null,
    html: '',
    videos: []
  },
  onLoad(query) {
    this.setData({ id: query.id, isPublic: query.public === '1' })
    this.load()
  },
  async load() {
    wx.showLoading({ title: '加载中', mask: true })
    try {
      const a = this.data.isPublic
        ? await get(`/tool/articles/public/${this.data.id}`)
        : await get(`/tool/articles/${this.data.id}`)
      this.setData({ article: { ...a, updatedText: String(a.updatedAt || '').slice(0, 10) } })
      const imgMap = {}
      let html = ''
      if (a.contentHtml) {
        // 富文本：将受保护的附件 URL 替换为本地临时文件
        const re = /\/api\/tool\/attachments\/(\d+)\/content/g
        html = String(a.contentHtml).replace(re, (m, aid) => {
          imgMap[aid] = imgMap[aid] || ''
          return imgMap[aid] || m
        })
        const ids = [...new Set(String(a.contentHtml).match(/\/api\/tool\/attachments\/(\d+)\/content/g) || [])]
          .map((m) => m.match(/(\d+)/)[1])
        for (const aid of ids) {
          try {
            imgMap[aid] = await downloadAttachment(aid)
          } catch (e) {
            // 忽略
          }
        }
        html = String(a.contentHtml).replace(/\/api\/tool\/attachments\/(\d+)\/content/g, (m, aid) => imgMap[aid] || m)
      } else {
        const ids = collectAttachmentIds(a.contentMd)
        for (const id of ids) {
          try {
            imgMap[id] = await downloadAttachment(id)
          } catch (e) {
            // 忽略失败图片
          }
        }
        html = renderMarkdownMp(a.contentMd, imgMap)
      }
      // 视频引用转为附件列表
      const videos = []
      const re = /@video\(attachment:(\d+)\)/g
      let m
      while ((m = re.exec(String(a.contentMd || '')))) {
        videos.push({ id: m[1], tmp: '' })
      }
      this.setData({ html, videos })
    } catch (e) {
      // 已统一提示
    } finally {
      wx.hideLoading()
    }
  },
  async playVideo(e) {
    const id = e.currentTarget.dataset.id
    wx.showLoading({ title: '加载视频', mask: true })
    try {
      const tmp = await downloadAttachment(id)
      const videos = this.data.videos.map((v) => (v.id === id ? { ...v, tmp } : v))
      this.setData({ videos })
      wx.previewMedia({
        sources: [{ url: tmp, type: 'video' }]
      })
    } catch (err) {
      wx.showToast({ title: '视频加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
