export type Theme = 'dark' | 'light'

export function getSavedTheme(): Theme {
  return (localStorage.getItem('metis-theme') as Theme) || 'dark'
}

export function saveTheme(theme: Theme) {
  localStorage.setItem('metis-theme', theme)
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}
