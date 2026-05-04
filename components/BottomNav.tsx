'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

const navItems = [
  {
    name: 'Búsqueda',
    href: '/',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    name: 'Estante',
    href: '/mi-estante',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    name: 'Recomendación',
    href: '/recomendacion',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
  {
    name: 'Perfil',
    href: '/login',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const index = navItems.findIndex(item => item.href === pathname);
    if (index !== -1) {
      setActiveIndex(index);
    } else {
      // Si estamos en login, marcar perfil como activo (índice 3)
      if (pathname.startsWith('/login')) {
        setActiveIndex(3);
      }
    }
  }, [pathname]);

  if (!isClient) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        :root {
          --bg-body: #020617; /* slate-950 */
          --bg-nav: #1e293b; /* slate-800 */
          --indicator-color: #34d399; /* emerald-400 */
        }
        
        .magic-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 70px;
          background: var(--bg-nav);
          z-index: 50;
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
        }

        .magic-nav ul {
          display: flex;
          width: 100%;
          padding: 0;
          margin: 0;
        }

        .magic-nav ul li {
          position: relative;
          list-style: none;
          flex: 1;
          height: 70px;
          z-index: 1;
        }

        .magic-nav ul li a {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          flex-direction: column;
          width: 100%;
          text-align: center;
          font-weight: 500;
          height: 100%;
        }

        .magic-nav ul li a .icon {
          position: relative;
          display: block;
          line-height: 70px;
          font-size: 1.5rem;
          text-align: center;
          transition: 0.5s;
          color: #94a3b8; /* slate-400 */
        }

        .magic-nav ul li.active a .icon {
          transform: translateY(-40px);
          color: var(--bg-body);
        }

        .magic-nav ul li a .text {
          position: absolute;
          color: #f8fafc; /* slate-50 */
          font-weight: 600;
          font-size: 0.70em;
          letter-spacing: 0.05em;
          transition: 0.5s;
          opacity: 0;
          transform: translateY(20px);
        }

        .magic-nav ul li.active a .text {
          transform: translateY(10px);
          opacity: 1;
        }

        .magic-indicator {
          position: absolute;
          top: -50%;
          width: 60px;
          height: 60px;
          background: var(--indicator-color);
          border-radius: 50%;
          transition: 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          /* Calculamos la posición X dinámicamente basado en los 4 elementos (25% cada uno) */
          /* Restamos la mitad del ancho del indicador (30px) y sumamos la mitad de un slot (12.5%) */
          transform: translateX(calc((var(--active-index) * 25vw) + (12.5vw - 30px)));
        }
      `}} />

      <div className="magic-nav flex items-center justify-center md:hidden" style={{ '--active-index': activeIndex } as React.CSSProperties}>
        <ul>
          {navItems.map((item, index) => (
            <li key={item.href} className={`list ${activeIndex === index ? 'active' : ''}`}>
              <Link href={item.href}>
                <span className="icon">
                  {item.icon}
                </span>
                <span className="text">{item.name}</span>
              </Link>
            </li>
          ))}
          <div className="magic-indicator"></div>
        </ul>
      </div>
    </>
  );
}
