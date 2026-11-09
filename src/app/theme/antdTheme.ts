import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

const FONT_FAMILY =
  "'Inter', 'HarmonyOS Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";

/**
 * 全局 Ant Design 主题：所有颜色/圆角/字体统一在此收口，
 * 组件内不再写死色值，便于后续换肤与品牌定制。
 */
export const antdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  cssVar: { prefix: 'T-HU' },
  token: {
    colorPrimary: '#22d3ee',
    colorInfo: '#4f8bff',
    colorSuccess: '#34d399',
    colorError: '#f87171',
    colorBgBase: '#05070c',
    colorBgContainer: 'rgba(16, 23, 36, 0.86)',
    colorBgElevated: '#111a29',
    colorBorder: 'rgba(122, 162, 220, 0.16)',
    colorBorderSecondary: 'rgba(122, 162, 220, 0.09)',
    colorText: '#e9f0fb',
    colorTextSecondary: '#a9b8cf',
    colorTextTertiary: '#6f7f96',
    borderRadius: 12,
    borderRadiusLG: 14,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    controlHeight: 34,
    wireframe: false,
  },
  components: {
    Button: {
      primaryShadow: '0 8px 24px rgba(34, 211, 238, 0.25)',
      defaultBg: 'rgba(255, 255, 255, 0.03)',
      defaultBorderColor: 'rgba(122, 162, 220, 0.16)',
    },
    Input: {
      activeShadow: '0 0 0 2px rgba(34, 211, 238, 0.12)',
      colorBgContainer: 'rgba(255, 255, 255, 0.03)',
    },
    Dropdown: {
      paddingBlock: 5,
      controlItemBgHover: 'rgba(34, 211, 238, 0.1)',
    },
    Tooltip: {
      colorBgSpotlight: 'rgba(20, 28, 44, 0.96)',
    },
    Drawer: {
      colorBgElevated: '#080c14',
    },
    Modal: {
      contentBg: '#0c1220',
      headerBg: 'transparent',
    },
    Tag: {
      defaultBg: 'rgba(122, 162, 220, 0.1)',
    },
  },
};
