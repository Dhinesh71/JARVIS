const { searchWeb } = require('./utils/search');

async function test() {
    console.log('Testing searchWeb...');
    try {
        const results = await searchWeb('SpaceX');
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error('Test crashed:', e);
    }
}

test();
