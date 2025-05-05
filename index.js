const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { MongoClient } = require('mongodb');

// Stealth plugin'i ekle
puppeteer.use(StealthPlugin());

// MongoDB Atlas bağlantı URL'si (bu URL'yi sizden alacağım)
const uri = "mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=AtlasApp";

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
    let client;
    try {
        // MongoDB'ye bağlan
        client = new MongoClient(uri);
        await client.connect();
        console.log('MongoDB bağlantısı başarılı...');
        
        const database = client.db("linkedinDB");
        const collection = database.collection("users");
        
        // Kullanıcı bilgilerini çek
        const user = await collection.findOne({ status: "pending" });
        if (!user) {
            throw new Error("Kayıt bekleyen kullanıcı bulunamadı!");
        }
        
        console.log('Kullanıcı bilgileri alındı:', user.email);

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
        await realisticType(page, 'input[id="email-address"]', user.email);
        console.log('Email adresi girildi...');
        await randomSleep(1000, 2000);

        await realisticType(page, 'input[id="password"]', user.password);
        console.log('Şifre girildi...');
        await randomSleep(1000, 2000);

        // Step 3: Fill first name and last name
        await realisticType(page, 'input[id="first-name"]', user.firstName);
        console.log('İsim girildi...');
        await randomSleep(1000, 2000);

        await realisticType(page, 'input[id="last-name"]', user.lastName);
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
        await realisticType(page, 'input[id="typeahead-input-for-school-name"]', user.education.university);
        await randomSleep(1000, 2000);
        await page.keyboard.press('Enter');
        console.log('Üniversite bilgisi girildi...');
        await randomSleep(1000, 2000);

        // Select start year
        await page.waitForSelector('select[id="onboarding-profile-edu-start-year"]', { visible: true });
        await page.select('select[id="onboarding-profile-edu-start-year"]', user.education.startDate.year);
        console.log('Başlangıç yılı seçildi...');
        await randomSleep(1000, 2000);

        // Select end year
        await page.waitForSelector('select[id="onboarding-profile-edu-end-year"]', { visible: true });
        await page.select('select[id="onboarding-profile-edu-end-year"]', user.education.endDate.year);
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

        // Step 7: Email verification (manual)
        console.log('Lütfen email doğrulama kodunu manuel olarak girin...');
        await page.waitForSelector('input[id="email-confirmation-input"]', { visible: true });
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        console.log('Email doğrulaması tamamlandı...');

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

        const skipButton2 = await page.waitForSelector('button[id="ember693"]', { visible: true });
        const skipButton2Box = await skipButton2.boundingBox();
        await randomMouseMove(page, skipButton2Box.x + skipButton2Box.width/2, skipButton2Box.y + skipButton2Box.height/2);
        await randomSleep(500, 1500);
        await page.click('button[id="ember693"]');
        console.log('Geç butonuna tıklandı...');
        await randomSleep(2000, 4000);

        // Step 10: Finalize
        const finalButton = await page.waitForSelector('button[id="ember696"]', { visible: true });
        const finalButtonBox = await finalButton.boundingBox();
        await randomMouseMove(page, finalButtonBox.x + finalButtonBox.width/2, finalButtonBox.y + finalButtonBox.height/2);
        await randomSleep(500, 1500);
        
        // Tıklama ve navigasyonu birlikte bekle
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
            page.click('button[id="ember696"]')
        ]);
        console.log('Sonlandır butonuna tıklandı...');
        await randomSleep(2000, 4000);

        // Step 11: Wait for redirection to main page
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        if (page.url().includes('linkedin.com/feed')) {
            console.log('Başarıyla LinkedIn ana sayfasına ulaşıldı!');
            // Kullanıcı durumunu güncelle
            await collection.updateOne(
                { _id: user._id },
                { $set: { status: "completed" } }
            );
            console.log('Kullanıcı durumu güncellendi: completed');
        } else {
            console.log('Ana sayfaya yönlendirilemedi!');
        }

    } catch (error) {
        console.error('Bir hata oluştu:', error);
    } finally {
        // MongoDB bağlantısını kapat
        if (client) {
            await client.close();
        }
        // Keep browser open for manual verification
        // await browser.close();
    }
}

// Start the process
startLinkedInSignup(); 