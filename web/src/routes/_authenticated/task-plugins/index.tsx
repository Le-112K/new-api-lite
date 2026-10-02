// Stub: task plugin system removed, redirect to dashboard
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/task-plugins/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})
