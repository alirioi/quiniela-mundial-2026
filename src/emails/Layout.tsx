import * as React from 'react';
import { Html, Head, Body, Container, Tailwind, Preview } from '@react-email/components';

interface LayoutProps {
  children: React.ReactNode;
  previewText: string;
}

export default function Layout({ children, previewText }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                wc: {
                  red: '#E61D25',
                  green: '#3CAC3B',
                  blue: '#2A398D',
                  gold: '#F3C623',
                  dark: '#08080a',
                  card: '#121217',
                  border: '#1f1f27',
                },
              },
            },
          },
        }}
      >
        <Body className="bg-[#f6f9fc] my-auto mx-auto font-sans">
          <Container className="bg-white border border-gray-200 rounded-xl my-[40px] mx-auto max-w-[600px] shadow-sm overflow-hidden">
            {/* Header Banner Area */}
            <div className="w-full bg-[#111111]">
              <img 
                src="https://quiniela.alirioi.dev/banner-correo.jpg" 
                alt="Quiniela Mundial 2026" 
                width="600"
                style={{ width: '100%', maxWidth: '100%', display: 'block', border: 'none' }}
              />
            </div>

            {/* Email Content */}
            <div className="text-gray-800 p-[20px]">
              {children}
            </div>

            {/* Footer Area */}
            <div className="text-center pb-[20px] pt-[10px] border-t border-gray-100 mx-[20px]">
              <p className="text-sm text-gray-500 m-0">
                &copy; {new Date().getFullYear()} Quiniela Mundial 2026. Todos los derechos reservados.
              </p>
            </div>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
