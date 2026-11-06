import {defineConfig} from 'vitepress';
import {nav, sidebar} from './navigation.mjs';

export default defineConfig({
    base: process.env.DOCS_BASE ?? '/',
    'title': 'Portline',
    'description': 'The saved-connection library family: FileZilla, PuTTY/KiTTY, HeidiSQL, JetBrains, OpenSSH and WinSCP.',
    'lang': 'en-US',
    'appearance': false,
    'cleanUrls': false,
    'markdown': {
        'theme': 'github-dark-high-contrast',
    },
    'head': [
        [
            'meta',
            {
                'name': 'theme-color',
                'content': '#171a1d',
            },
        ],
    ],
    'themeConfig': {
        'siteTitle': 'Portline',
        'nav': nav,
        'sidebar': sidebar,
        'search': {
            'provider': 'local',
        },
        'outline': [
            2,
            3,
        ],
        'socialLinks': [
            {
                'icon': 'github',
                'link': 'https://github.com/h2ooooooo/portline',
            },
        ],
    },
});
