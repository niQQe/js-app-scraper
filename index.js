import fetch from 'node-fetch';
import dotenv from 'dotenv/config';
import nodemailer from 'nodemailer';
import ioredis from 'ioredis';

const db = new ioredis(process.env.REDIS_URL);
const rooms = 4;
const targets = {
	Finfast: {
		url: 'https://finfast.se/lediga-objekt',
		scrapeFilter: (text) => {
			const apps = text
				.replace(/\n|\t/g, '')
				.trim()
				.match(/<dt class="title">(.*?)<\/dt>/g)
				.map((val) => /<strong>(.*?)<\/strong>/g.exec(val)[0].replace(/<strong>|<\/strong>/g, ''))
				.filter((app) => +app[0][0] === rooms).join`\n`;
			return apps.length ? apps : '';
		},
	},
	Lundbergs: {
		url: `https://www.lundbergsfastigheter.se/bostad/lediga-lagenheter/orebro?rum=${rooms}`,
		scrapeFilter: (text) => {
			const apps = text
				.replace(/\n|\t/g, '')
				.trim()
				.match(/<td>(.*?)<\/td>/g)
				.filter((row) => !row.includes('button'))
				.map((row) => {
					const parsedRow = row
						.replace(/<td>|<\/td|<span>|<\/span>|\>|<\/a|<!-- --/g, '')
						.replace(/<a/, ' %');
					const indexOfSpecialChar = parsedRow.indexOf('%');
					return indexOfSpecialChar != -1 ? parsedRow.slice(0, indexOfSpecialChar).trim() : parsedRow;
				})
				.reduce((acc, curr, index) => {
					if (index != 0 && index % 5 === 0) curr = ',' + curr;
					acc += ' ' + curr;
					return acc;
				}, '').split`,`
				.map((t) => t.trim())
				.filter((row) => row.includes(`Rum:${rooms}`)).join`\n`;
			return apps.length ? apps : '';
		},
	},
};

const getScrapedAppartments = async () => {
	let result = {};
	for (const propertyOwner in targets) {
		const html = await (await fetch(targets[propertyOwner].url)).text();
		const scrapeData = targets[propertyOwner].scrapeFilter(html);
		result[propertyOwner] = scrapeData;
	}
	return result;
};

const generateMessage = (text) => {
	let message = '';
	for (let propertyOwner in text) {
		if (text[propertyOwner]) message += `${propertyOwner}\n${text[propertyOwner]}\n\n`;
	}
	return message;
};

const sendMail = (available) => {
	const transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: process.env.user,
			pass: process.env.pass,
		},
	});
	transporter.sendMail({
		from: 'nickewideving@gmail.com',
		to: 'nickewideving@gmail.com',
		subject: 'Lediga 4or!!',
		text: generateMessage(available),
	});
};

const getStoredData = async () => {
	const keys = await db.keys('*');
	return await keys.reduce(async (accPromise, key) => {
		const data = await accPromise;
		data[key] = await db.get(key);
		return data;
	}, Promise.resolve({}));
};

const compareData = (scrapeData, storedData) => JSON.stringify(scrapeData) === JSON.stringify(storedData);

const setNewData = (scrapeData) => {
	for (const propertyOwner in scrapeData) db.set(propertyOwner, scrapeData[propertyOwner]);
};

const runScraper = async () => {
	const scrapeData = await getScrapedAppartments();
	const storedData = await getStoredData();
	const isAlreadyInDB = compareData(scrapeData, storedData);
	if (isAlreadyInDB) {
		console.log('No new data');
	} else {
		console.log('New data found');
		setNewData(scrapeData);
		sendMail(scrapeData);
	}
	db.quit();
};

runScraper();
