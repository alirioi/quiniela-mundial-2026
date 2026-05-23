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
          <Container className="bg-white border border-gray-200 rounded-xl my-[40px] mx-auto p-[20px] max-w-[600px] shadow-sm">
            {/* Header Logo Area */}
            <div className="text-center mb-8 mt-4">
              <div className="inline-block align-middle mr-3 text-[48px] leading-none">
                🏆
              </div>
              <div className="inline-block align-middle text-left">
                <div className="text-[28px] font-black tracking-[0.2em] text-gray-900 leading-none">
                  QUINIELA
                </div>
                <div className="text-[16px] font-extrabold tracking-wider mt-1">
                  <span className="text-wc-red">MUN</span>
                  <span className="text-wc-gold">DIAL </span>
                  <span className="text-wc-green">2026</span>
                </div>
              </div>
            </div>

            {/* Email Content */}
            <div className="text-gray-800">
              {children}
            </div>

            {/* Footer Area */}
            <div className="text-center mt-8 pt-6 border-t border-gray-200">
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
