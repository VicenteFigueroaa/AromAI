# 🌟 AromAI - Tu Sommelier de Fragancias Personalizado

AromAI es una aplicación web premium diseñada para entusiastas de la perfumería que utiliza Inteligencia Artificial (Google Gemini) para analizar, catalogar y recomendar fragancias basadas en el clima y el contexto del usuario.

![AromAI UI Preview](public/preview-banner.png) *(Añade tu propia captura de pantalla aquí)*

## ✨ Características Principales

- **🧠 Análisis con IA:** Obtén notas de salida, corazón y base, junto con descripciones poéticas generadas por Gemini AI.
- **⚡ Sistema de Caché Inteligente:** Respuestas instantáneas para perfumes ya analizados y corrección automática de erratas (Aliasing).
- **📱 Experiencia Móvil "Magic":** Interfaz optimizada para móviles con una barra de navegación inferior animada y fluida.
- **☁️ Recomendaciones por Clima:** Sugiere el perfume perfecto analizando datos de temperatura, humedad y radiación UV en tiempo real.
- **🪙 Economía Freemium:** Sistema de créditos (3 diarios gratuitos) con recarga mediante visualización de anuncios (simulados).
- **🧺 Estante Virtual:** Guarda tu colección y ten siempre a mano los detalles de tus fragancias favoritas.

## 🛠️ Stack Tecnológico

- **Frontend:** Next.js 15 (App Router), Tailwind CSS.
- **Backend:** Next.js API Routes, Server Actions.
- **Base de Datos & Auth:** Supabase (PostgreSQL).
- **IA:** Google Generative AI (Gemini Pro).

## 🚀 Instalación y Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/arom-ai.git
   cd arom-ai
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Variables de Entorno:**
   Crea un archivo `.env.local` en la raíz y añade tus llaves:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_llave_anon_publica
   SUPABASE_SERVICE_ROLE_KEY=tu_llave_service_role_privada
   GEMINI_API_KEY=tu_llave_de_google_ai
   ```

4. **Configuración de Base de Datos (Supabase):**
   Ejecuta los siguientes comandos SQL en el editor de Supabase para preparar las tablas:

   ```sql
   -- 1. Tabla de Perfiles (Extensión de Auth)
   create table profiles (
     id uuid references auth.users on delete cascade primary key,
     search_credits integer default 3,
     ads_watched_today integer default 0,
     last_ad_date date default current_date
   );

   -- 2. Tabla de Caché de Perfumes
   create table perfumes (
     search_key text primary key,
     data jsonb not null,
     created_at timestamp with time zone default timezone('utc'::text, now())
   );

   -- 3. Tabla de Alias (Corrección de erratas)
   create table perfume_aliases (
     typo_key text primary key,
     canonical_key text not null
   );

   -- 4. Tabla de Historial de Recomendaciones
   create table recommendation_history (
     id uuid default gen_random_uuid() primary key,
     user_id uuid references auth.users on delete cascade,
     context jsonb,
     recommendation jsonb,
     feedback boolean,
     created_at timestamp with time zone default now()
   );
   ```

5. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```

### 1. Sistema de Proxy (Middleware v16)
#### [FILE] [proxy.ts](file:///c:/Users/vjavi/Desktop/AromAI/arom-ai/proxy.ts)
En esta versión de Next.js 16, la protección de rutas y el refresco de sesión de Supabase se gestionan a través del archivo `proxy.ts`. Este archivo asegura que páginas como `/mi-estante` redirijan al login si no hay una sesión activa.

## 📱 Vista Móvil
La aplicación incluye un componente `BottomNav` personalizado que se activa automáticamente en pantallas móviles, ofreciendo una navegación gestual y visualmente atractiva con el "Magic Indicator".

## 🛡️ Licencia
Este proyecto es de código abierto bajo la licencia MIT.

---
Desarrollado con ❤️ por **AromAI Team**.
