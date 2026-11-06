import type {DefaultTheme} from 'vitepress';

export const nav: DefaultTheme.NavItem[] = [
    {
        'text': 'Overview',
        'link': '/',
    },
    {
        'text': 'Libraries',
        'link': '/libraries/',
        'activeMatch': '^/(libraries/|ecosystem)',
    },
    {
        'text': 'Workflows',
        'link': '/workflows/',
        'activeMatch': '^/workflows/',
    },
    {
        'text': 'Build an integration',
        'link': '/integration/',
        'activeMatch': '^/(integration/|api/|cli/|guide/|reference/|profile-writing|connection-profiles|development|contributing)',
    },
];

export const sidebar: DefaultTheme.Sidebar = {
    '/libraries/': [
        {
            'text': 'Libraries',
            'collapsed': false,
            'items': [
                {
                    'text': 'Application directory',
                    'link': '/libraries/',
                },
                {
                    'text': 'Choose a library',
                    'link': '/libraries/compare',
                },
                {
                    'text': 'Related tools',
                    'link': '/libraries/related',
                },
                {
                    'text': 'Complete ecosystem',
                    'link': '/ecosystem',
                },
            ],
        },
        {
            'text': 'Use saved connections',
            'collapsed': false,
            'items': [
                {
                    'text': 'Read and select a source',
                    'link': '/workflows/read',
                },
                {
                    'text': 'Authentication and keys',
                    'link': '/workflows/authentication',
                },
                {
                    'text': 'Cross-application sync',
                    'link': '/workflows/sync',
                },
            ],
        },
    ],
    '/ecosystem': [
        {
            'text': 'Libraries',
            'collapsed': false,
            'items': [
                {
                    'text': 'Application directory',
                    'link': '/libraries/',
                },
                {
                    'text': 'Choose a library',
                    'link': '/libraries/compare',
                },
                {
                    'text': 'Related tools',
                    'link': '/libraries/related',
                },
                {
                    'text': 'Complete ecosystem',
                    'link': '/ecosystem',
                },
            ],
        },
        {
            'text': 'Use saved connections',
            'collapsed': false,
            'items': [
                {
                    'text': 'Read and select a source',
                    'link': '/workflows/read',
                },
                {
                    'text': 'Authentication and keys',
                    'link': '/workflows/authentication',
                },
                {
                    'text': 'Cross-application sync',
                    'link': '/workflows/sync',
                },
            ],
        },
    ],
    '/workflows/': [
        {
            'text': 'Workflows',
            'collapsed': false,
            'items': [
                {
                    'text': 'Choose a task',
                    'link': '/workflows/',
                },
                {
                    'text': 'Find a saved connection',
                    'link': '/workflows/read',
                },
                {
                    'text': 'Authentication and key paths',
                    'link': '/workflows/authentication',
                },
                {
                    'text': 'Preview a one-way sync',
                    'link': '/workflows/sync',
                },
                {
                    'text': 'Write safety and recovery',
                    'link': '/workflows/safety',
                },
            ],
        },
        {
            'text': 'Find the right tool',
            'collapsed': false,
            'items': [
                {
                    'text': 'Application libraries',
                    'link': '/libraries/',
                },
                {
                    'text': 'Compare support',
                    'link': '/libraries/compare',
                },
                {
                    'text': 'Transfers, SSH and keys',
                    'link': '/libraries/related',
                },
            ],
        },
    ],
    '/integration/': [
        {
            'text': 'Build an integration',
            'collapsed': false,
            'items': [
                {
                    'text': 'Overview',
                    'link': '/integration/',
                },
                {
                    'text': 'Installation',
                    'link': '/integration/installation',
                },
                {
                    'text': 'Language setup',
                    'link': '/integration/examples',
                },
            ],
        },
        {
            'text': 'Shared API',
            'collapsed': false,
            'items': [
                {
                    'text': 'API overview',
                    'link': '/integration/api/',
                },
                {
                    'text': 'Catalog quick start',
                    'link': '/integration/api/quick-start',
                },
                {
                    'text': 'Read and search',
                    'link': '/integration/queries',
                },
                {
                    'text': 'Credential providers',
                    'link': '/integration/credentials',
                },
                {
                    'text': 'Sync planning',
                    'link': '/integration/sync',
                },
                {
                    'text': 'Profiles and snapshots',
                    'link': '/integration/profiles',
                },
            ],
        },
        {
            'text': 'CLI toolkit',
            'collapsed': false,
            'items': [
                {
                    'text': 'CLI overview',
                    'link': '/integration/cli/',
                },
                {
                    'text': 'CLI quick start',
                    'link': '/integration/cli/quick-start',
                },
                {
                    'text': 'Inputs, output and errors',
                    'link': '/integration/cli/commands',
                },
                {
                    'text': 'Source and writer hooks',
                    'link': '/integration/cli/hooks',
                },
            ],
        },
        {
            'text': 'Advanced and reference',
            'collapsed': true,
            'items': [
                {
                    'text': 'Native writers and safeguards',
                    'link': '/integration/native-writing',
                },
                {
                    'text': 'Architecture and boundaries',
                    'link': '/integration/architecture',
                },
                {
                    'text': 'Exports and contracts',
                    'link': '/integration/reference/api',
                },
                {
                    'text': 'Exact TypeScript signatures',
                    'link': '/integration/reference/types',
                },
            ],
        },
        {
            'text': 'Contributing',
            'collapsed': true,
            'items': [
                {
                    'text': 'Development and checks',
                    'link': '/integration/development',
                },
                {
                    'text': 'Contributing',
                    'link': '/integration/contributing',
                },
                {
                    'text': 'Repository fixtures',
                    'link': '/integration/local-demo',
                },
            ],
        },
    ],
    '/': [
        {
            'text': 'Build an integration',
            'collapsed': false,
            'items': [
                {
                    'text': 'Overview',
                    'link': '/integration/',
                },
                {
                    'text': 'Installation',
                    'link': '/integration/installation',
                },
                {
                    'text': 'Language setup',
                    'link': '/integration/examples',
                },
            ],
        },
        {
            'text': 'Shared API',
            'collapsed': false,
            'items': [
                {
                    'text': 'API overview',
                    'link': '/integration/api/',
                },
                {
                    'text': 'Catalog quick start',
                    'link': '/integration/api/quick-start',
                },
                {
                    'text': 'Read and search',
                    'link': '/integration/queries',
                },
                {
                    'text': 'Credential providers',
                    'link': '/integration/credentials',
                },
                {
                    'text': 'Sync planning',
                    'link': '/integration/sync',
                },
                {
                    'text': 'Profiles and snapshots',
                    'link': '/integration/profiles',
                },
            ],
        },
        {
            'text': 'CLI toolkit',
            'collapsed': false,
            'items': [
                {
                    'text': 'CLI overview',
                    'link': '/integration/cli/',
                },
                {
                    'text': 'CLI quick start',
                    'link': '/integration/cli/quick-start',
                },
                {
                    'text': 'Inputs, output and errors',
                    'link': '/integration/cli/commands',
                },
                {
                    'text': 'Source and writer hooks',
                    'link': '/integration/cli/hooks',
                },
            ],
        },
        {
            'text': 'Advanced and reference',
            'collapsed': true,
            'items': [
                {
                    'text': 'Native writers and safeguards',
                    'link': '/integration/native-writing',
                },
                {
                    'text': 'Architecture and boundaries',
                    'link': '/integration/architecture',
                },
                {
                    'text': 'Exports and contracts',
                    'link': '/integration/reference/api',
                },
                {
                    'text': 'Exact TypeScript signatures',
                    'link': '/integration/reference/types',
                },
            ],
        },
        {
            'text': 'Contributing',
            'collapsed': true,
            'items': [
                {
                    'text': 'Development and checks',
                    'link': '/integration/development',
                },
                {
                    'text': 'Contributing',
                    'link': '/integration/contributing',
                },
                {
                    'text': 'Repository fixtures',
                    'link': '/integration/local-demo',
                },
            ],
        },
    ],
};
