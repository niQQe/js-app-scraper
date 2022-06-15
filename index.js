import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

const lookingFor = 4;

const getAppartments = async () => {
	const res = await fetch('https://finfast.se/lediga-objekt');
	const text = (await res.text()).trim();
	const availableAppartments = text
		.replace(/\n|\t/g, '')
		.trim()
		.match(/<dt class="title">(.*?)<\/dt>/g)
		.map((val) => /<strong>(.*?)<\/strong>/g.exec(val)[0].replace(/<strong>|<\/strong>/g, ''))
		.filter((app) => +app[0][0] === lookingFor).join`\n`;

	return availableAppartments.length ? availableAppartments : null;
};

async function main() {
	console.log('LETAR...');
	if (!(await getAppartments())) {
		console.log('INGA LEDIGA 4OR');
		return;
	}
	const transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: 'nickewideving@gmail.com',
			pass: 'fujwxqlgzwsqxejh',
		},
	});

	transporter.sendMail({
		from: 'nickewideving@gmail.com',
		to: 'chilivit@hotmail.com',
		subject: 'Finfast lediga 4or!!',
		text: await getAppartments(),
	});
}

main();
