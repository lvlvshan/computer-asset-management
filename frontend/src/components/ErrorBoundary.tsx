import { Component, ErrorInfo, ReactNode } from 'react'
import { Button, Result } from 'antd'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="页面出现错误"
          subTitle={this.state.error?.message || '未知错误'}
          extra={
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              {this.state.error?.stack && (
                <pre style={{ textAlign: 'left', fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 16, maxHeight: 300, overflow: 'auto' }}>
                  {this.state.error.stack}
                </pre>
              )}
              <Button type="primary" onClick={() => { this.setState({ hasError: false }); window.location.reload() }}>
                刷新页面
              </Button>
            </div>
          }
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
