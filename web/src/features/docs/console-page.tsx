import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'

import { DocsContent } from '.'

/**
 * 控制台内的配置文档。
 *
 * 点侧边栏不再是跳到前台的公开文档页（那会丢掉控制台外壳，等于离开当前页），
 * 而是在主内容区就地渲染——布局与「使用日志」等页面一致：标题行 + 内容区。
 *
 * 内容与前台 /docs 共用 {@link DocsContent}，不存在两份文案。
 */
export function ConsoleDocsPage() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Configuration docs')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <DocsContent />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
