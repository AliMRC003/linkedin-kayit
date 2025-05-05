const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const mongoose = require('mongoose');
const { createTempEmailAccount, getVerificationCode } = require('./mailService');
const User = require('./models/User');
require('dotenv').config();

// Stealth plugin'i ekle
puppeteer.use(StealthPlugin());

// Rastgele bekleme fonksiyonu
function randomSleep(min = 1000, max = 3000) {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));
}

// Rastgele mouse hareketi
async function randomMouseMove(page, x, y) {
    const steps = 10;
    const stepX = x / steps;
    const stepY = y / steps;
    
    for (let i = 0; i < steps; i++) {
        await page.mouse.move(stepX * i, stepY * i);
        await randomSleep(50, 150);
    }
}

// Rastgele scroll
async function randomScroll(page) {
    const scrollAmount = Math.floor(Math.random() * 500) + 100;
    await page.evaluate((amount) => {
        window.scrollBy(0, amount);
    }, scrollAmount);
    await randomSleep(500, 1500);
}

// Gerçekçi yazma fonksiyonu
async function realisticType(page, selector, text) {
    await page.waitForSelector(selector, { visible: true });
    await page.focus(selector);
    
    for (let char of text) {
        await page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
        await randomSleep(50, 150);
    }
}

async function startLinkedInSignup() {
    let browser;
    try {
        // MongoDB'ye bağlan
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB bağlantısı başarılı...');

        // Bekleyen bir kullanıcı bul
        const pendingUser = await User.findOne({ status: 'pending' });
        if (!pendingUser) {
            throw new Error('Kayıt bekleyen kullanıcı bulunamadı!');
        }

        // Geçici e-posta oluştur
        console.log('Geçici e-posta oluşturuluyor...');
        const { address, password, token } = await createTempEmailAccount();
        console.log('Geçici e-posta oluşturuldu:', address);

        // Kullanıcının email ve şifresini güncelle
        await User.updateOne(
            { _id: pendingUser._id },
            { 
                $set: { 
                    email: address,
                    password: password,
                    mailToken: token,
                    updatedAt: new Date()
                }
            }
        );
        console.log('Kullanıcı bilgileri güncellendi:', address);

        // Launch browser with stealth settings
        browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--start-maximized',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
            ],
            defaultViewport: null,
        });

        const page = await browser.newPage();

        // User agent ayarla
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

        // WebGL ve Canvas spoofing
        await page.evaluateOnNewDocument(() => {
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                if (parameter === 37445) return 'Intel Inc.';
                if (parameter === 37446) return 'Intel Iris OpenGL Engine';
                return getParameter(parameter);
            };
        });

        // Navigator webdriver'ı gizle
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        console.log('Tarayıcı başlatıldı...');

        // Step 1: Navigate to LinkedIn signup page (Turkish version)
        await page.goto('https://www.linkedin.com/signup?_l=tr', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        console.log('LinkedIn Türkçe kayıt sayfasına ulaşıldı...');
        await randomSleep(2000, 4000);

        // Rastgele scroll yap
        await randomScroll(page);

        // Step 2: Fill email and password
        await realisticType(page, 'input[id="email-address"]', address);
        console.log('Email adresi girildi...');
        await randomSleep(1000, 2000);

        await realisticType(page, 'input[id="password"]', password);
        console.log('Şifre girildi...');
        await randomSleep(1000, 2000);

        // Step 3: Fill first name and last name
        await realisticType(page, 'input[id="first-name"]', 'Test');
        console.log('İsim girildi...');
        await randomSleep(1000, 2000);

        await realisticType(page, 'input[id="last-name"]', 'User');
        console.log('Soyisim girildi...');
        await randomSleep(1000, 2000);

        // Step 4: Click join button with mouse movement
        const joinButton = await page.waitForSelector('button[id="join-form-submit"]', { visible: true });
        const buttonBox = await joinButton.boundingBox();
        await randomMouseMove(page, buttonBox.x + buttonBox.width/2, buttonBox.y + buttonBox.height/2);
        await randomSleep(500, 1500);
        
        // Tıklama ve navigasyonu birlikte bekle
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
            page.click('button[id="join-form-submit"]')
        ]);
        console.log('Kayıt formu gönderildi...');
        await randomSleep(2000, 4000);

        // Step 5: Check for security verification
        try {
            // Daha kapsamlı güvenlik kontrolü
            const hasChallenge = await page.$('div[data-test-id="challenge-form"]');
            const hasRecaptcha = await page.$('iframe[src*="recaptcha"]');
            const hasVerification = await page.$('div[data-test-id="verification-form"]');
            
            if (hasChallenge || hasRecaptcha || hasVerification) {
                console.log('Güvenlik doğrulaması gerekiyor, lütfen manuel olarak tamamlayın...');
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });
                console.log('Güvenlik doğrulaması tamamlandı...');
            } else {
                console.log('Güvenlik doğrulaması gerekmedi, eğitim sayfasına geçiliyor...');
            }
        } catch (error) {
            console.log('Güvenlik doğrulaması gerekmedi, eğitim sayfasına geçiliyor...');
        }

        // Step 6: Fill education information
        const studentButton = await page.waitForSelector('button[id="ember16"]', { visible: true });
        const studentButtonBox = await studentButton.boundingBox();
        await randomMouseMove(page, studentButtonBox.x + studentButtonBox.width/2, studentButtonBox.y + studentButtonBox.height/2);
        await randomSleep(500, 1500);
        
        // Tıklama ve navigasyonu birlikte bekle
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
            page.click('button[id="ember16"]')
        ]);
        console.log('Öğrenci seçeneği seçildi...');
        await randomSleep(2000, 4000);

        // Fill university
        await realisticType(page, 'input[id="typeahead-input-for-school-name"]', 'Test University');
        await randomSleep(1000, 2000);
        await page.keyboard.press('Enter');
        console.log('Üniversite bilgisi girildi...');
        await randomSleep(1000, 2000);

        // Select start year
        await page.waitForSelector('select[id="onboarding-profile-edu-start-year"]', { visible: true });
        await page.select('select[id="onboarding-profile-edu-start-year"]', '2020');
        console.log('Başlangıç yılı seçildi...');
        await randomSleep(1000, 2000);

        // Select end year
        await page.waitForSelector('select[id="onboarding-profile-edu-end-year"]', { visible: true });
        await page.select('select[id="onboarding-profile-edu-end-year"]', '2024');
        console.log('Bitiş yılı seçildi...');
        await randomSleep(1000, 2000);

        // Click continue
        const continueButton = await page.waitForSelector('button[data-test-onboarding-profile-education-continue-button="true"]', { visible: true });
        const continueButtonBox = await continueButton.boundingBox();
        await randomMouseMove(page, continueButtonBox.x + continueButtonBox.width/2, continueButtonBox.y + continueButtonBox.height/2);
        await randomSleep(500, 1500);
        
        // Tıklama ve navigasyonu birlikte bekle
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
            page.click('button[data-test-onboarding-profile-education-continue-button="true"]')
        ]);
        console.log('Eğitim bilgileri kaydedildi...');
        await randomSleep(2000, 4000);

        // Step 7: Email verification
        console.log('Email doğrulama kodu bekleniyor...');
        const verificationCode = await getVerificationCode(token);
        if (verificationCode) {
            await realisticType(page, 'input[id="email-confirmation-input"]', verificationCode);
            console.log('Email doğrulama kodu girildi...');
            await randomSleep(1000, 2000);
        } else {
            throw new Error('Email doğrulama kodu alınamadı!');
        }

        // Step 8: Select job seeker intent
        const jobSeekerRadio = await page.waitForSelector('input[id="onboarding-job-seeker-intent-radio-button-PASSIVE"]', { visible: true });
        const radioBox = await jobSeekerRadio.boundingBox();
        await randomMouseMove(page, radioBox.x + radioBox.width/2, radioBox.y + radioBox.height/2);
        await randomSleep(500, 1500);
        await page.click('input[id="onboarding-job-seeker-intent-radio-button-PASSIVE"]');
        console.log('İş arama durumu seçildi...');
        await randomSleep(1000, 2000);

        // Click next
        const nextButton = await page.waitForSelector('button[id="ember125"]', { visible: true });
        const nextButtonBox = await nextButton.boundingBox();
        await randomMouseMove(page, nextButtonBox.x + nextButtonBox.width/2, nextButtonBox.y + nextButtonBox.height/2);
        await randomSleep(500, 1500);
        
        // Tıklama ve navigasyonu birlikte bekle
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
            page.click('button[id="ember125"]')
        ]);
        console.log('İleri butonuna tıklandı...');
        await randomSleep(2000, 4000);

        // Step 9: Skip additional steps
        const skipButton = await page.waitForSelector('span.artdeco-button__text:has-text("Şimdilik geç")', { visible: true });
        const skipButtonBox = await skipButton.boundingBox();
        await randomMouseMove(page, skipButtonBox.x + skipButtonBox.width/2, skipButtonBox.y + skipButtonBox.height/2);
        await randomSleep(500, 1500);
        await page.click('span.artdeco-button__text:has-text("Şimdilik geç")');
        console.log('Ek adımlar atlandı...');
        await randomSleep(2000, 4000);

        // Step 10: Final skip
        const finalSkipButton = await page.waitForSelector('button[id="ember693"]', { visible: true });
        const finalSkipButtonBox = await finalSkipButton.boundingBox();
        await randomMouseMove(page, finalSkipButtonBox.x + finalSkipButtonBox.width/2, finalSkipButtonBox.y + finalSkipButtonBox.height/2);
        await randomSleep(500, 1500);
        await page.click('button[id="ember693"]');
        console.log('Son adım atlandı...');
        await randomSleep(2000, 4000);

        // Kullanıcı durumunu güncelle
        await User.updateOne(
            { email: address },
            { 
                $set: { 
                    status: 'completed',
                    updatedAt: new Date()
                }
            }
        );
        console.log('Kullanıcı kaydı tamamlandı:', address);

    } catch (error) {
        console.error('Hata oluştu:', error);
    } finally {
        if (browser) {
            await browser.close();
            console.log('Tarayıcı kapatıldı...');
        }
        await mongoose.connection.close();
        console.log('MongoDB bağlantısı kapatıldı...');
    }
}

// Uygulamayı başlat
startLinkedInSignup(); 