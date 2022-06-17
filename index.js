import fetch from 'node-fetch';
import dotenv from 'dotenv/config';
import nodemailer from 'nodemailer';
import ioredis from 'ioredis';

const client = new ioredis(process.env.REDIS_URL);

client.set('test', 'JADÅ');

client.get('test', (err, res) => {
	console.log(res);
});
// const rooms = 4;
// const targets = {
// 	Finfast: {
// 		url: 'https://finfast.se/lediga-objekt',
// 		scrapeFilter: (text) => {
// 			const apps = text
// 				.replace(/\n|\t/g, '')
// 				.trim()
// 				.match(/<dt class="title">(.*?)<\/dt>/g)
// 				.map((val) => /<strong>(.*?)<\/strong>/g.exec(val)[0].replace(/<strong>|<\/strong>/g, ''))
// 				.filter((app) => +app[0][0] === rooms).join`\n`;
// 			return apps.length ? apps : null;
// 		},
// 	},
// 	Lundbergs: {
// 		url: `https://www.lundbergsfastigheter.se/bostad/lediga-lagenheter/orebro?rum=${rooms}`,
// 		scrapeFilter: (text) => {
// 			const apps = text
// 				.replace(/\n|\t/g, '')
// 				.trim()
// 				.match(/<td>(.*?)<\/td>/g)
// 				.filter((row) => !row.includes('button'))
// 				.map((row) => {
// 					const parsedRow = row
// 						.replace(/<td>|<\/td|<span>|<\/span>|\>|<\/a|<!-- --/g, '')
// 						.replace(/<a/, ' %');
// 					const indexOfSpecialChar = parsedRow.indexOf('%');
// 					return indexOfSpecialChar != -1 ? parsedRow.slice(0, indexOfSpecialChar).trim() : parsedRow;
// 				})
// 				.reduce((acc, curr, index) => {
// 					if (index != 0 && index % 5 === 0) curr = ',' + curr;
// 					acc += ' ' + curr;
// 					return acc;
// 				}, '').split`,`
// 				.map((t) => t.trim())
// 				.filter((row) => row.includes(`Rum:${rooms}`)).join`\n`;
// 			return apps.length ? apps : null;
// 		},
// 	},
// };

// const getHtml = async (owner) => {
// 	try {
// 		const res = await fetch(targets[owner].url);
// 		return res.text();
// 	} catch (e) {
// 		console.log(e);
// 	}
// };

// const getAvailableAppartments = async () => {
// 	console.log('Lets take a look...');
// 	let result = {};
// 	for (const owner in targets) {
// 		const html = await getHtml(owner);
// 		const available = targets[owner].scrapeFilter(html);
// 		if (available) result[owner] = available;
// 	}
// 	return Object.keys(result).length ? result : null;
// };

// const generateMessage = (text) => {
// 	let message = '';
// 	for (let owner in text) message += `${owner}\n${text[owner]}\n\n`;
// 	return message;
// };

// const sendMail = (available) => {
// 	const transporter = nodemailer.createTransport({
// 		service: 'gmail',
// 		auth: {
// 			user: process.env.user,
// 			pass: process.env.pass,
// 		},
// 	});
// 	transporter.sendMail({
// 		from: 'nickewideving@gmail.com',
// 		to: 'nickewideving@gmail.com, chilivit@hotmail.com',
// 		subject: 'Lediga 4or!!',
// 		text: generateMessage(available),
// 	});
// };

// async function runScraper() {
// 	const available = await getAvailableAppartments();
// 	if (available) {
// 		console.log('There are available Appartments!');
// 		sendMail(available);
// 	} else {
// 		console.log('No available appartments :(');
// 	}
// }

// runScraper();
