import fetch from 'node-fetch';
import dotenv from 'dotenv/config';
import nodemailer from 'nodemailer';
import ioredis from 'ioredis';
import { parse } from 'node-html-parser';

const db = new ioredis(process.env.REDIS_URL);
const lookingForSize = 4;
const targets = {
	Finfast: {
		url: 'https://finfast.se/lediga-objekt',
		scrapeFilter: (html) => {
			const root = parse(html);
			const result = root.querySelectorAll('.title').reduce((acc, curr) => {
				const app = curr.childNodes[1].childNodes[0].childNodes[0]._rawText.replace(/\n|\t/g, '');
				const [size] = app;
				if (lookingForSize == size) acc.push(app);
				return acc;
			}, []).join`\n`;

			return result.length ? result : '';
		},
	},
	Lundbergs: {
		url: `https://www.lundbergsfastigheter.se/bostad/lediga-lagenheter/orebro?rum=${lookingForSize}`,
		scrapeFilter: (html) => {
			const root = parse(html);
			const result = root.querySelectorAll('.closed').reduce((acc, curr) => {
				const adress = curr.childNodes[0].childNodes[0]._rawText;
				const sizeInfo = curr.childNodes[2].childNodes[1]._rawText;
				const [size] = sizeInfo;
				if (lookingForSize == size) acc.push(`${adress}, ${sizeInfo}`);
				return acc;
			}, []).join`\n`;
			return result.length ? result : '';
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
		if (text[propertyOwner] > '') message += `${propertyOwner}\n${text[propertyOwner]}\n\n`;
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
		to: 'nickewideving@gmail.com, chilivit@hotmail.com',
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
