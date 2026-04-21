# 💰 Budget Dashboard — PWA

Tu presupuesto personal inteligente con análisis de comprobantes por IA.

## 🚀 Deploy en Vercel (5 minutos)

### Opción A — Deploy directo desde GitHub (recomendado)

1. **Subí el proyecto a GitHub:**
   - Entrá a [github.com](https://github.com) y creá una cuenta si no tenés
   - Creá un repositorio nuevo llamado `budget-dashboard`
   - Subí todos estos archivos

2. **Deploy en Vercel:**
   - Entrá a [vercel.com](https://vercel.com) y creá una cuenta gratis (podés usar tu cuenta de GitHub)
   - Hacé click en "Add New Project"
   - Seleccioná tu repositorio `budget-dashboard`
   - Vercel detecta Vite automáticamente — no hay nada que configurar
   - Hacé click en "Deploy"
   - En 2 minutos tenés tu URL: `budget-dashboard-tuusuario.vercel.app`

### Opción B — Deploy con Vercel CLI

```bash
npm install -g vercel
npm install
npm run build
vercel --prod
```

## 📱 Instalar como app en el celular

### Android (Chrome):
1. Abrí tu URL en Chrome
2. Tocá los 3 puntitos → "Agregar a pantalla de inicio"
3. Confirmá — aparece el ícono como una app nativa

### iPhone (Safari):
1. Abrí tu URL en Safari
2. Tocá el botón compartir (cuadrado con flecha)
3. "Agregar a pantalla de inicio"
4. Confirmá

## 🔑 API Key de Anthropic (para análisis de fotos)

La app usa Claude para leer tus comprobantes. Necesitás una API key:

1. Entrá a [console.anthropic.com](https://console.anthropic.com)
2. Creá una API key
3. En el archivo `src/App.jsx`, buscá la función `analyzeReceiptWithClaude`
4. Agregá el header: `"x-api-key": "TU_API_KEY"`

> ⚠️ Nunca subas tu API key a GitHub. Usá variables de entorno de Vercel:
> - En Vercel → Settings → Environment Variables
> - Agregá `VITE_ANTHROPIC_API_KEY = tu_key`
> - En el código: `"x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY`

## 🛠️ Desarrollo local

```bash
npm install
npm run dev
```

Abrí `http://localhost:5173`
