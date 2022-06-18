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

const getAvailableAppartments = async () => {
	const scrapedData = await Object.keys(targets).reduce(async (accPromise, propertyOwner) => {
		const data = await accPromise;
		const html = await (await fetch(targets[propertyOwner].url)).text();
		const scrapeData = targets[propertyOwner].scrapeFilter(html);
		data[propertyOwner] = scrapeData;
		return data;
	}, Promise.resolve({}));

	const storedData = await (await db.keys('*')).reduce(async (accPromise, propertyOwner) => {
		const data = await accPromise;
		data[propertyOwner] = await db.get(propertyOwner);
		return data;
	}, Promise.resolve({}));

	if (JSON.stringify(scrapedData) !== JSON.stringify(storedData)) {
		for (const propertyOwner in scrapedData) db.set(propertyOwner, scrapedData[propertyOwner]);
		return scrapedData;
	}
	return null;
};

const generateMessage = (text) => {
	return Object.keys(text).reduce((message, propertyOwner) => {
		if (text[propertyOwner] > '') message += `${propertyOwner}\n${text[propertyOwner]}\n\n`;
		return message;
	}, '');
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

const runScraper = async () => {
	const available = await getAvailableAppartments();
	if (available) {
		console.log('New data found');
		sendMail(available);
	} else {
		console.log('No new data');
	}
	db.quit();
};

runScraper();
