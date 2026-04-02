import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/app/AppRoot'
import './ui/theme/theme.css'

createRoot(document.getElementById('root')!).render(<App />)
