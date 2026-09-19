import { useEffect, useState } from 'react'
import { Button, Card, Input, Select, Space, Switch, Tabs, TextArea, Toast, Typography } from '@douyinfe/semi-ui'
import { IconBell, IconComment, IconKey, IconSave, IconTickCircle, IconUser } from '@douyinfe/semi-icons'
import { aiApi, toolApi } from '../api'

const { Title, Text } = Typography
const { TabPane } = Tabs

export default function Settings() {
  const [barkUrl, setBarkUrl] = useState('')
  const [digestTime, setDigestTime] = useState('')
  const [barkEnabled, setBarkEnabled] = useState(true)
  const [siteName, setSiteName] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [footer, setFooter] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [testing, setTesting] = useState(false)
  const [aiProvider, setAiProvider] = useState('deepseek')
  const [aiModel, setAiModel] = useState('deepseek-chat')
  const [aiBaseUrl, setAiBaseUrl] = useState('https://api.deepseek.com')
  const [aiKey, setAiKey] = useState('')
  const [aiKeyMasked, setAiKeyMasked] = useState('')
  const [aiTesting, setAiTesting] = useState(false)
  const [wxAppid, setWxAppid] = useState('')
  const [wxSecret, setWxSecret] = useState('')
  const [wxHasSecret, setWxHasSecret] = useState(false)

  useEffect(() => {
    toolApi.settings().then((s) => {
      setBarkUrl(s.barkUrl || '')
      setDigestTime(s.digestTime || '')
      setBarkEnabled(s.barkEnabled !== false)
      setSiteName(s.siteName || '')
      setAnnouncement(s.announcement || '')
      setFooter(s.footer || '')
    })
    aiApi.config().then((c) => {
      setAiProvider(c.provider || 'deepseek')
      setAiModel(c.model || 'deepseek-chat')
      setAiBaseUrl(c.baseUrl || 'https://api.deepseek.com')
      setAiKeyMasked(c.keyMasked || '')
    }).catch(() => {})
    toolApi.wxConfig().then((w) => {
      setWxAppid(w.appid || '')
      setWxHasSecret(!!w.hasSecret)
    }).catch(() => {})
  }, [])

  const saveBark = async () => {
    await toolApi.saveSettings({
      barkUrl: barkUrl.trim(),
      digestTime: digestTime.trim(),
      barkEnabled: barkEnabled ? 'true' : 'false'
    })
    Toast.success('Bark 设置已保存')
  }

  const test = async () => {
    setTesting(true)
    try {
      const ok = await toolApi.testBark(barkUrl.trim())
      Toast[ok ? 'success' : 'error'](ok ? '推送成功，请查看手机通知' : '推送失败，请检查 Bark 地址')
    } finally {
      setTesting(false)
    }
  }

  const saveSite = async () => {
    await toolApi.saveSettings({
      siteName: siteName.trim(),
      announcement: announcement.trim(),
      footer: footer.trim()
    })
    Toast.success('站点设置已保存')
  }

  const savePin = async () => {
    if (pin.length < 4) {
      Toast.warning('PIN 码至少 4 位')
      return
    }
    if (pin !== pin2) {
      Toast.warning('两次输入不一致')
      return
    }
    await toolApi.setPin(pin)
    Toast.success('PIN 码已设置')
    setPin('')
    setPin2('')
  }

  const saveAi = async () => {
    await toolApi.saveSettings({
      aiProvider,
      aiModel: aiModel.trim() || 'deepseek-chat',
      aiBaseUrl: aiBaseUrl.trim() || 'https://api.deepseek.com',
      aiApiKey: aiKey
    })
    Toast.success('AI 配置已保存')
    setAiKey('')
  }

  const testAi = async () => {
    setAiTesting(true)
    try {
      const ok = await aiApi.test({ apiKey: aiKey, model: aiModel, baseUrl: aiBaseUrl })
      Toast[ok ? 'success' : 'error'](ok ? 'AI 连接成功' : 'AI 连接失败')
    } finally {
      setAiTesting(false)
    }
  }

  const saveWx = async () => {
    await toolApi.saveSettings({ wxAppid: wxAppid.trim(), wxSecret })
    Toast.success('微信配置已保存')
    setWxSecret('')
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', background: 'var(--semi-color-bg-1)', borderRadius: 8, padding: 20 }}>
      <Tabs defaultActiveKey="bark">
        <TabPane tab={<span><IconBell /> Bark 推送</span>} itemKey="bark">
          <Card style={{ marginTop: 8 }}>
            <Text type="tertiary">iOS 安装 Bark 后复制推送地址（形如 https://api.day.app/xxxxx）。后端每 30 秒扫描待办，支持单次提醒、逾期催办、循环提醒和每日明日待办预告。</Text>
            <Space style={{ width: '100%', margin: '14px 0' }}>
              <Input placeholder="Bark 推送地址" value={barkUrl} onChange={setBarkUrl} style={{ flex: 1 }} />
              <Switch checked={barkEnabled} onChange={setBarkEnabled} />
              <Text size="small">{barkEnabled ? '已启用' : '已停用'}</Text>
            </Space>
            <Input placeholder="每日汇总时间，如 21:00" value={digestTime} onChange={setDigestTime} />
            <Space style={{ marginTop: 16 }}>
              <Button type="primary" icon={<IconSave />} onClick={saveBark}>保存设置</Button>
              <Button loading={testing} onClick={test}>发送测试推送</Button>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab={<span><IconTickCircle /> 站点设置</span>} itemKey="site">
          <Card style={{ marginTop: 8 }}>
            <Space vertical align="start" style={{ width: '100%' }}>
              <div style={{ width: '100%' }}>
                <Text strong>站点名称</Text>
                <Input placeholder="显示在顶部导航与登录页" value={siteName} onChange={setSiteName} style={{ marginTop: 8 }} />
              </div>
              <div style={{ width: '100%' }}>
                <Text strong>公告</Text>
                <TextArea placeholder="首页/登录页公告（可选）" value={announcement} onChange={setAnnouncement} rows={2} style={{ marginTop: 8 }} />
              </div>
              <div style={{ width: '100%' }}>
                <Text strong>页脚</Text>
                <Input placeholder="页脚文字（可选）" value={footer} onChange={setFooter} style={{ marginTop: 8 }} />
              </div>
              <Button type="primary" icon={<IconSave />} onClick={saveSite}>保存设置</Button>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab={<span><IconKey /> PIN 码</span>} itemKey="pin">
          <Card style={{ marginTop: 8 }}>
            <Text type="tertiary">在微信小程序中查看保险箱明文前需要验证 PIN 码（Web 端不受影响）。</Text>
            <Space style={{ width: '100%', marginTop: 14 }}>
              <Input mode="password" placeholder="设置 PIN 码（至少 4 位）" value={pin} onChange={setPin} style={{ flex: 1 }} />
              <Input mode="password" placeholder="确认 PIN 码" value={pin2} onChange={setPin2} style={{ flex: 1 }} />
              <Button type="primary" onClick={savePin}>设置</Button>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab={<span><IconComment /> AI 助手</span>} itemKey="ai">
          <Card style={{ marginTop: 8 }}>
            <Text type="tertiary">配置 DeepSeek 后，右下角 AI 助手可通过对话新建待办、查询工资、写文章、查保险箱等。</Text>
            <Space vertical align="start" style={{ width: '100%', marginTop: 14 }}>
              <div style={{ width: '100%' }}>
                <Text strong>服务商</Text>
                <Select value={aiProvider} onChange={setAiProvider} style={{ width: '100%', marginTop: 8 }}
                  optionList={[{ value: 'deepseek', label: 'DeepSeek' }]} />
              </div>
              <div style={{ width: '100%' }}>
                <Text strong>模型</Text>
                <Input placeholder="deepseek-chat" value={aiModel} onChange={setAiModel} style={{ marginTop: 8 }} />
              </div>
              <div style={{ width: '100%' }}>
                <Text strong>接口地址</Text>
                <Input placeholder="https://api.deepseek.com" value={aiBaseUrl} onChange={setAiBaseUrl} style={{ marginTop: 8 }} />
              </div>
              <div style={{ width: '100%' }}>
                <Text strong>API Key</Text>
                <Input mode="password" placeholder={aiKeyMasked ? `已配置 ${aiKeyMasked}（留空不修改）` : 'sk-...'} value={aiKey} onChange={setAiKey} style={{ marginTop: 8 }} />
              </div>
              <Space>
                <Button type="primary" icon={<IconSave />} onClick={saveAi}>保存配置</Button>
                <Button loading={aiTesting} onClick={testAi}>测试连接</Button>
              </Space>
            </Space>
          </Card>
        </TabPane>

        <TabPane tab={<span><IconUser /> 微信登录</span>} itemKey="wx">
          <Card style={{ marginTop: 8 }}>
            <Text type="tertiary">配置小程序 AppID 与 AppSecret 后，小程序端支持“微信一键登录/无感登录”（wx.login → 后端换取 openid）。AppSecret 加密存储。</Text>
            <Space vertical align="start" style={{ width: '100%', marginTop: 14 }}>
              <div style={{ width: '100%' }}>
                <Text strong>小程序 AppID</Text>
                <Input placeholder="wx..." value={wxAppid} onChange={setWxAppid} style={{ marginTop: 8 }} />
              </div>
              <div style={{ width: '100%' }}>
                <Text strong>AppSecret</Text>
                <Input mode="password" placeholder={wxHasSecret ? '已配置（留空不修改）' : '小程序后台获取'} value={wxSecret} onChange={setWxSecret} style={{ marginTop: 8 }} />
              </div>
              <Button type="primary" icon={<IconSave />} onClick={saveWx}>保存配置</Button>
            </Space>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  )
}
