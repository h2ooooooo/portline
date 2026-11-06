import {defineComponent, h} from 'vue';
import catalog from '../../../ecosystem.json';
import './LibraryCards.css';

const applications = catalog.entries.filter(entry => entry.family === 'portline' && entry.applications.length > 0);

export default defineComponent({
    name: 'LibraryCards',
    setup() {
        return () => h('ul', {class: 'application-grid', 'aria-label': 'Application libraries'}, applications.map(application =>
            h('li', {key: application.id, class: 'application-card'}, [
                h('h3', null, [h('a', {href: application.documentation}, application.name)]),
                h('p', {class: 'description'}, application.description),
                h('nav', {class: 'guides', 'aria-label': application.name + ' documentation'}, [
                    h('a', {
                        class: 'api-guide',
                        href: application.documentation + 'api/',
                        'aria-label': application.name + ' API documentation',
                    }, 'API'),
                    h('a', {
                        class: 'cli-guide',
                        href: application.documentation + 'cli/',
                        'aria-label': application.name + ' CLI documentation',
                    }, 'CLI'),
                ]),
                h('a', {class: 'how-it-works', href: application.documentation + 'guide/how-it-works.html'}, 'How it works'),
            ]),
        ));
    },
});
