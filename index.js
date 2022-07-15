import fetch from 'node-fetch';
import dotenv from 'dotenv/config';
import nodemailer from 'nodemailer';
import ioredis from 'ioredis';
import { parse } from 'node-html-parser';

const db = new ioredis(process.env.REDIS_URL);

const targets = {
	Finfast: {
		url: 'https://finfast.se/lediga-objekt',
		scrapeFilter: (html) => {
			const root = parse(html);
			const result = root.querySelectorAll('.title').reduce((apps, htmlTag) => {
				const app = htmlTag.childNodes[1].childNodes[0].childNodes[0]._rawText.replace(/\n|\t/g, '');
				const size = app.split` `[0].replace(/,/g, '.');
				if (+size > 3) apps.push(app);
				return apps;
			}, []).join`\n`;
			return result.length ? result : '';
		},
	},
	Lundbergs: {
		url: `https://www.lundbergsfastigheter.se/bostad/lediga-lagenheter/orebro?rum=4`,
		scrapeFilter: (html) => {
			const root = parse(html);
			const result = root.querySelectorAll('.closed').reduce((apps, htmlTag) => {
				const adress = htmlTag.childNodes[0].childNodes[0]._rawText;
				const sizeInfo = htmlTag.childNodes[2].childNodes[1]._rawText;
				const [size] = sizeInfo;
				if (+size === 4) apps.push(`${adress}, ${sizeInfo}`);
				return apps;
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

	const storedData = await (
		await db.keys('*')
	).reduce(async (accPromise, propertyOwner) => {
		const data = await accPromise;
		data[propertyOwner] = await db.get(propertyOwner);
		return data;
	}, Promise.resolve({}));

	if (JSON.stringify(scrapedData) !== JSON.stringify(storedData)) {
		console.log('New data found');
		for (const propertyOwner in scrapedData) await db.set(propertyOwner, scrapedData[propertyOwner]);
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
		subject: 'Lediga lägenheter!!',
		text: generateMessage(available),
	});
};

const runScraper = async () => {
	const available = await getAvailableAppartments();
	if (available) sendMail(available);
	else console.log('No new data');
	db.quit();
};

runScraper();
