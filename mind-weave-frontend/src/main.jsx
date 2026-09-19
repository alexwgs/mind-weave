import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from '@douyinfe/semi-ui'
import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN'
import App from './App'
import { AuthProvider } from './auth'
import { ThemeProvider, useTheme } from './theme'
import CommunityNotifier from './components/CommunityNotifier'
import './styles.css'
import './workspace.css'

function ThemedApp() {
  const { mode } = useTheme()
  return (
    <ConfigProvider locale={zh_CN} theme={{ mode }}>
      <BrowserRouter>
        <AuthProvider>
          <CommunityNotifier />
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </React.StrictMode>
)
