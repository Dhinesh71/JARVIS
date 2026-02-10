const { solveQuiz } = require('./utils/browserAgent');

const url = 'https://quizz-master-two.vercel.app/quiz/1a074ae0-4849-499d-9313-48fe92619291';
const userDetails = {
    name: 'Dhinesh V',
    email: 'dhineshjk17@gmail.com',
    phone: '9025873422',
    regNo: '731723106007'
};

solveQuiz(url, userDetails)
    .then(result => console.log('Quiz completed:', result))
    .catch(err => console.error('Quiz failed:', err));
