import type { ReactNode } from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { antdTheme } from '@/app/theme/antdTheme';

dayjs.locale('zh-cn');

/** 全局 Provider 收口：主题、国际化、消息上下文，便于后续接入 QueryClient / 状态库 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <AntdApp className="antd-app-root" message={{ maxCount: 3 }}>
        {children}
      </AntdApp>
    </ConfigProvider>
  );
}
