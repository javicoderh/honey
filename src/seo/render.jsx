import { renderToString } from 'react-dom/server';
import App from '../App';

export function renderPage(pathname, products) {
  return renderToString(<App initialPathname={pathname} initialProducts={products} />);
}
