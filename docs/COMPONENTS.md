# Components

## 1. UI library

Use shadcn/ui + Tailwind CSS.

## 2. Base components

- Button
- Input
- Textarea
- Select
- Dialog
- Sheet
- Card
- Badge
- Table
- Tabs
- Dropdown Menu
- Toast/Sonner
- Alert Dialog
- Skeleton

## 3. App-specific components

### AppShell

Responsibilities:

- RTL layout.
- Sidebar/topbar.
- Mobile navigation.
- User menu.

### StatusBadge

Props:

```ts
type StatusBadgeProps = {
  status: 'missing' | 'in_purchase' | 'fulfilled' | 'cancelled'
}
```

Displays Arabic label and consistent color.

### RequestCard

Mobile-first shortage request display.

Shows:

- item name
- pharmacy
- quantity
- status
- priority
- notes preview
- action buttons based on allowed actions

### RequestTable

Desktop shortage request display with columns:

- item
- pharmacy
- quantity
- status
- requested by
- assigned to
- created at
- actions

### AddRequestDialog

Fields:

- item search/select
- quantity
- priority
- notes

### ItemSearchCombobox

Searches active items by:

- Arabic name
- English name
- barcode
- SKU

### EmptyState

Used when no requests/items/users exist.

### ErrorState

Used for failed data loads.

### PageHeader

Title, description, primary action.

## 4. Component rules

- Components may hide actions for UX.
- Components must not be the only permission enforcement layer.
- Critical mutations call server actions.
- Arabic labels live in UI mapping files.
- Database values stay English.
