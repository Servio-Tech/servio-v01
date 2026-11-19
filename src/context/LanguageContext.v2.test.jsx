import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './LanguageContext';

function LanguageProbe() {
  const { language, toggleLanguage } = useLanguage();
  return <button onClick={toggleLanguage}>{language}</button>;
}

function openMenu() {
  render(<MemoryRouter initialEntries={['/menu/example/1']}><LanguageProvider><LanguageProbe /></LanguageProvider></MemoryRouter>);
}

describe('guest language selection', () => {
  beforeEach(() => localStorage.clear());

  test('detects English browser language and lets the guest switch to Arabic', async () => {
    Object.defineProperty(navigator, 'languages', { configurable: true, value: ['en-US'] });
    openMenu();
    const button = await screen.findByRole('button', { name: 'en' });
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'ar' })).toBeInTheDocument();
    expect(localStorage.getItem('servio_language_menu')).toBe('ar');
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
  });

  test('prefers the guest’s saved Arabic selection over an English browser', async () => {
    Object.defineProperty(navigator, 'languages', { configurable: true, value: ['en-US'] });
    localStorage.setItem('servio_language_menu', 'ar');
    openMenu();
    expect(await screen.findByRole('button', { name: 'ar' })).toBeInTheDocument();
  });
});
