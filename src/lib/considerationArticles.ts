export type ConsiderationExampleOutcome = "loss" | "saved";

export type ConsiderationArticleExample = {
  title: string;
  body: string;
  outcome: ConsiderationExampleOutcome;
};

export type ConsiderationArticleSection = {
  heading: string;
  paragraphs: string[];
  checklist?: string[];
  examples?: ConsiderationArticleExample[];
};

export type ConsiderationArticle = {
  lead: string;
  sections: ConsiderationArticleSection[];
  checklistTitle: string;
  quickChecklist: string[];
  closing: string;
  disclaimer: string;
};

const BUYING_LAND_EN: ConsiderationArticle = {
  lead:
    "Buying land in Nepal is often the largest financial decision a family makes. A plot that looks perfect on a broker's phone can hide forged papers, unpaid taxes, boundary disputes, or a road that does not legally exist. Spending a few days on verification before you pay an advance is far cheaper than years in court or losing your savings entirely.",
  sections: [
    {
      heading: "1. Legal documents — verify before you trust",
      paragraphs: [
        "The Lalpurja (land ownership certificate) is the starting point, not the finish line. Match the seller's name, plot number (kitta), ward, and area against the original at the Malpot (land revenue) office or through an authorised verification. Photocopies and 'fresh' Lalpurjas have been used in fraud cases where the real owner never agreed to sell.",
        "Ask for a recent Tiro (Malpot and Ghar Jagga Kar) receipt. Unpaid property tax can lead to Rokka (restriction) on the plot, blocking registration even after you have paid the seller. At Malpot or Napinaksha (survey) office, request a Tres Naksha and Bhumi Sudhar record to learn whether the land is mortgaged (Rokka), under court order, or subject to government acquisition.",
      ],
      checklist: [
        "Lalpurja — verify name, thar, kitta number, and area at Malpot or against the original.",
        "Char Killa (four boundaries) — confirm east, west, north, and south neighbours match field reality and the deed.",
        "Area — compare Lalpurja figures (ropani, bigha, dhur, aana) with Napinaksha measurement; small differences are common, large gaps are a red flag.",
        "Tiro — check Malpot and local Ghar Jagga Kar are paid; keep receipts.",
        "Rokka / Fukua — confirm no bank mortgage, court dispute, or government hold before token money.",
        "Dakhila Kharij — plan registration at Malpot promptly after purchase; until then, you are not on government records.",
      ],
      examples: [
        {
          outcome: "loss",
          title: "Advance paid on a 'clean' photocopy",
          body: "A buyer in Lalitpur paid Rs. 8 lakh token on a Lalpurja copy the broker claimed was 'just at home for renewal.' At Malpot, the plot was Rokka for a bank loan the seller had taken two years earlier. Registration was impossible without clearing the loan. The seller disappeared; the buyer is still pursuing the case in district court.",
        },
        {
          outcome: "saved",
          title: "One Malpot visit before token",
          body: "A family in Pokhara was about to pay advance on a riverside plot. A Tres Naksha check showed an ongoing partition case between the seller's brothers. They walked away and later learned the case took four years to settle — time they would have spent with money stuck in a disputed property.",
        },
      ],
    },
    {
      heading: "2. Physical condition — what you see is not always what you own",
      paragraphs: [
        "Road access is not simply 'there is a path.' Confirm whether access is on a government road (sadak) or only a private easement through a neighbour's land. Narrow lanes that may be widened under local plans can eat into your frontage. Visit in the rainy season if possible — slopes that look dry in winter can flood or slide.",
        "Check for Mohi (tenant farmer) rights on agricultural land. Mohiyani hak does not vanish when you buy; the buyer may need a formal Mohi Lagat Katta process. Walk the boundaries with the seller and ideally a neighbour or local witness; fence lines and planted trees often tell a different story than the deed.",
        "If you are buying khet, bari, or pakho land for farming, ask about badar (monkeys) and badel (wild boar) from nearby jungle or community forest. In the hills and inner Terai, monkey troops raid maize, fruit, and vegetables by day; wild boar dig through fields at night. These problems do not appear on Lalpurja, so sellers may not mention them. Visit at dawn or dusk, look for tracks and damaged crops on neighbouring plots, and ask whether fencing or changing crop type is realistic before you pay.",
      ],
      checklist: [
        "Legal road access — government road vs private right-of-way; width and future widening risk.",
        "Landlocked risk — if access depends on one neighbour's goodwill, get it in writing before buying.",
        "Mohi / tenant — ask at Malpot and locally whether anyone holds cultivation rights.",
        "Badar (monkeys) — crop raids from nearby forest; common on khet, bari, and pakho near jungle.",
        "Badel (wild boar) — night damage to maize, potato, and vegetables; high risk on forest-edge plots.",
        "Boundary disputes — talk to adjoining owners; look for old court stickers or ward mediation records.",
        "Terrain — landslide, flood, or seasonal waterlogging; soil suitable for your plan (house, farm, commercial).",
        "Encroachment — check whether any structure, road, or drain sits on the plot.",
      ],
      examples: [
        {
          outcome: "loss",
          title: "A path, not a road",
          body: "After building a house in Bhaktapur, the owner learned the 'road' was only a neighbour's informal track. When the neighbour sold their land, the new owner blocked access. Legalising a permanent easement cost more than Rs. 15 lakh and two years of negotiation — none of which appeared in the sale deed.",
        },
        {
          outcome: "saved",
          title: "Boundary walk before signing",
          body: "Buyers in Dang measured the plot with a tape and found the southern boundary was short by roughly one dhur compared with the Lalpurja. The seller agreed to a price reduction before any money changed hands. A Napinaksha survey later confirmed the gap.",
        },
        {
          outcome: "loss",
          title: "Scenic bari, ruined harvest",
          body: "A buyer in Sindhuli purchased a pakho bari marketed for commercial vegetables. In the first season, badar from the ridge forest destroyed most of the crop. Neighbours said the seller had stopped farming for the same reason. Full fencing cost more than the buyer had budgeted for the farm itself.",
        },
      ],
    },
    {
      heading: "3. Government and local rules — what you may build or use",
      paragraphs: [
        "Land is classified in records — agricultural (khet), residential (abaddi), forest, commercial, and others. Building a house on agricultural land usually requires land conversion (rupantaran) and local approval; buying without checking classification can stop construction entirely. The Bhumi Upyog Naksha (land-use map) at the local level shows how the area is zoned.",
        "Ask the ward and municipality about setback lines, minimum road width, and whether the plot falls in a hazard or conservation zone. Road-widening plans, high-tension lines, and public acquisition notices have affected buyers who only looked at the Lalpurja.",
      ],
      checklist: [
        "Land classification on Lalpurja — khet vs abaddi vs other; conversion needed for your use?",
        "Bhumi Upyog Naksha — residential, commercial, agricultural, or mixed zoning at local level.",
        "Building setback and coverage — distance from road centreline and plot boundaries.",
        "Conversion / rupantaran — fees and timeline if changing from agricultural to residential.",
        "Public acquisition — check ward/municipality for road expansion, pipeline, or project notices.",
        "Ailani jagga — confirm the plot is not government or unregistered land (ailani) before purchase.",
        "Utilities — water, electricity, sewer feasibility; some plots cannot get a building permit without them.",
      ],
      examples: [
        {
          outcome: "loss",
          title: "House plan rejected after purchase",
          body: "A buyer in Chitwan purchased khet-class land assuming 'everyone builds here.' The municipality refused a building permit without land conversion and a wider access road than existed. Conversion and road contribution added over Rs. 12 lakh — costs never mentioned by the broker.",
        },
        {
          outcome: "saved",
          title: "Zoning checked at the ward",
          body: "Before paying token on a commercial plot in Butwal, the buyer confirmed with the ward office that the stretch was marked for business use in the local plan. A cheaper plot one street away was agricultural only; friends who bought there still cannot open a shop legally.",
        },
      ],
    },
    {
      heading: "4. Before money changes hands",
      paragraphs: [
        "Use a written agreement (typed or stamped) stating price, payment schedule, deadline for Dakhila Kharij, and who pays taxes and fees. Pay token through banking channels where possible. If the seller insists on cash-only and skipping Malpot verification, treat that as a warning, not a discount.",
        "Many buyers use our land area converter to cross-check ropani and bigha figures, and the land registration tax calculator to budget stamp duty and registration — but calculators cannot replace Malpot verification.",
      ],
      checklist: [
        "Written sale agreement with clear timelines and penalties for default.",
        "Pay in instalments tied to verification milestones — not the full amount before Malpot check.",
        "Witnesses and ID copies of all sellers if joint or inherited property.",
        "Inheritance / bakas patra — if the seller inherited the land, confirm all legal heirs have consented.",
        "Budget for registration tax, lawyer/notary, and survey if needed — not just the plot price.",
      ],
    },
  ],
  checklistTitle: "Quick checklist before you pay",
  quickChecklist: [
    "Malpot verification of Lalpurja and Tres Naksha",
    "Tiro and Ghar Jagga Kar receipts",
    "No Rokka, court case, or mortgage",
    "Napinaksha / area matches deed",
    "Legal road access confirmed",
    "No Mohi or boundary dispute",
    "Badar and badel risk checked on farming land",
    "Land class and local zoning fit your plan",
    "Written agreement and traceable payments",
  ],
  closing:
    "Due diligence on land is unglamorous work. It does not make a broker happy and it slows down a deal — which is exactly why it protects you. The families who lose money rarely lost it because Nepal's laws are impossible; they lost it because verification was treated as optional.",
  disclaimer:
    "This article is general information for buyers in Nepal, not legal advice. Rules vary by local level and may change. For high-value purchases, consult a property lawyer and verify everything at the relevant Malpot and local government offices.",
};

const BUYING_LAND_NE: ConsiderationArticle = {
  lead:
    "नेपालमा जग्गा किन्दा भविष्यमा हुन सक्ने झन्झटबाट बच्न जग्गाको कानुनी कागजपत्र (लालपुर्जा), जग्गाको भौतिक अवस्था र सरकारी मापदण्डमा विशेष ध्यान दिनुपर्छ। बिचौलियाले देखाएको 'सफा' जग्गामा नक्कली कागज, बाँकी कर, सीमा विवाद वा कानुनी बाटो नहुनु जस्ता समस्या लुकेको हुन सक्छ। अग्रिम रकम बुझाउनु अघि केही दिन जाँच गर्नु वर्षौँ अदालत वा सम्पूर्ण बचत गुमाउनुभन्दा सस्तो पर्छ।",
  sections: [
    {
      heading: "१. कानुनी कागजपत्र (कागजात जाँच)",
      paragraphs: [
        "जग्गाधनी प्रमाण पुर्जा (लालपुर्जा) सुरुवाती कागज हो, अन्तिम पुष्टि होइन। विक्रेताको नाम, थर, कित्ता नम्बर, वडा र क्षेत्रफल मालपोत कार्यालयमा गएर वा मूल प्रतिसँग भिडान गरेर मिलाउनुहोस्। फोटोकपी वा 'नवीकरणमा छ' भनिएका लालपुर्जाबाट धोखा हुने घटना भएका छन् — जहाँ वास्तविक धनीले बेच्न सहमति जनाएका थिएनन्।",
        "मालपोत र घरजग्गा कर (तिरो) हालसालै तिरिएको रसिद हेर्नुहोस्। कर बाँकी भए जग्गामा रोक्का लाग्न सक्छ र नामसारी रोकिन्छ। मालपोत वा नापी कार्यालयबाट ट्रेस नक्सा र भूमिसुधार सम्बन्धी जानकारी लिई जग्गा बैंकमा धितो (रोक्का) छ कि छैन, अदालतको मुद्दा छ कि छैन भनेर पक्का गर्नुहोस्।",
      ],
      checklist: [
        "लालपुर्जा रुजु — नाम, थर, कित्ता नम्बर र क्षेत्रफल मालपोत वा मूल प्रतिसँग मिलाउने।",
        "चारकिल्ला — पूर्व, पश्चिम, उत्तर, दक्षिण सिमाना कागजात र जग्गामा भिडान गर्ने।",
        "क्षेत्रफल — लालपुर्जाको रोपनी, बिघा, धुर, आना नापी नक्सासँग तुलना; ठूलो भिन्नता खतरा संकेत।",
        "तिरो — मालपोत र स्थानीय घरजग्गा कर तिरिएको रसिद हेर्ने।",
        "रोक्का वा फुकुवा — टोकन अघि बैंक धितो, अदालती मुद्दा वा सरकारी होल्ड छैन भनेर पक्का गर्ने।",
        "दाखिला खारेज — किनमेलपछि छिटो मालपोतमा नामसारी गर्ने योजना; नभएसम्म तपाईं सरकारी अभिलेखमा दर्ता हुनुहुन्न।",
      ],
      examples: [
        {
          outcome: "loss",
          title: "'सफा' फोटोकपीमा अग्रिम रकम",
          body: "ललितपुरमा एक क्रेताले बिचौलियाले 'नवीकरणमा मात्र घरमा छ' भनेको लालपुर्जाको प्रतिलिपिमा रु. ८ लाख टोकन बुझाए। मालपोतमा जाँच गर्दा जग्गा दुई वर्षअघि लिएको बैंक ऋणको धितोमा रोक्का थियो। ऋण नतिरी नामसारी सम्भव थिएन। विक्रेता हराए; क्रेताले अझै जिल्ला अदालतमा मुद्दा चलाइरहेका छन्।",
        },
        {
          outcome: "saved",
          title: "टोकन अघि एक पटक मालपोत",
          body: "पोखराको एक परिवार नदी किनारको जग्गामा अग्रिम बुझाउन लागे। ट्रेस नक्सा जाँचमा विक्रेताका दाजुभाइबीच विभाजन मुद्दा चलिरहेको देखियो। उनीहरू फर्किए। पछि मुद्दा चार वर्ष लाग्यो — त्यो समय उनीहरूको रकम विवादित जग्गामा अड्किने थियो।",
        },
      ],
    },
    {
      heading: "२. जग्गाको भौतिक अवस्था",
      paragraphs: [
        "बाटोको पहुँच भन्नाले 'बाटो देखिन्छ' मात्र होइन। जग्गासम्म पुग्न सरकारी बाटो (सडक) छ वा छिमेकीको जग्गाबाट मात्र पाइलो बाटो छ भनेर छुट्ट्याउनुहोस्। साँघुरो बाटो भविष्यमा विस्तार हुँदा जग्गा मासिने जोखिम हुन्छ। सक्दो भए वर्षा ऋतुमा जग्गा हेर्नुहोस् — जाडोमा सुक्खा देखिने ठाउँ वर्षामा डुबान वा पहिरो हुन सक्छ।",
        "कृषि जग्गामा मोही (कमैया/कमाउने) को नाम छ कि छैन मालपोत र स्थानीय रूपमा सोध्नुहोस्। जग्गा किन्दा मोहियानी हक आफैँ मेटिदैन; मोही लगत कट्टा प्रक्रिया आवश्यक पर्न सक्छ। विक्रेतासँग सीमाना हिँड्नुहोस् र सक्दो छिमेकीसँग कुरा गर्नुहोस् — बार र रूखले कहिलेकाहीँ कागजभन्दा फरक कथा भन्छन्।",
        "खेत, बारी वा पाखोबारी कृषिका लागि किन्दै हुनुहुन्छ भने नजिकैको जंगल वा सामुदायिक वनबाट बादर (बाँदर) र बँदेलको समस्या सोध्नुहोस्। पहाडी र भित्री मधेसमा बाँदरले दिउँसो मकै, फलफूल र तरकारी खान्छ; बँदेलले राति खेत खन्ने गर्छ। यो लालपुर्जामा देखिँदैन, विक्रेताले भन्न नसक्ने पनि हुन्छ। बिहान वा साँझ जग्गा हेर्नुहोस्, छिमेकी खेतमा नोक्सानी छ कि छैन हेर्नुहोस्, र बार लगाउने वा बाली परिवर्तन सम्भव छ कि छैन सोध्नुहोस्।",
      ],
      checklist: [
        "कानुनी बाटो पहुँच — सरकारी सडक वा निजी बाटो अधिकार; चौडाइ र भविष्यमा विस्तारको जोखिम।",
        "बन्द घेरामा पर्ने जोखिम — एउटै छिमेकीको मन्जुरीमा भर पर्छ भने लिखित प्रमाण बिना किन्नु हुँदैन।",
        "मोही — कसैले कमाउने अधिकार राखेको छ कि छैन।",
        "बादर (बाँदर) — जंगल नजिकको खेत/बारीमा बाली नोक्सान; मकै, फलफूल र तरकारीमा बढी असर।",
        "बँदेल — राति खेत खन्ने; वन किनारको जग्गामा मकै, आलु र तरकारीमा जोखिम।",
        "सीमा विवाद — छिमेकीसँग कुरा; पुरानो अदालती सूचना वा वडा मेलमिलाप अभिलेख।",
        "भू–भौतिक अवस्था — पहिरो, डुबान, ढलान; घर, खेती वा व्यापारका लागि माटो उपयुक्त छ कि छैन।",
        "अतिक्रमण — जग्गामा अरूको संरचना, बाटो वा नाला त छैन।",
      ],
      examples: [
        {
          outcome: "loss",
          title: "बाटो होइन, पाइलो बाटो",
          body: "भक्तपुरमा घर बनेपछि मालिकले 'बाटो' वास्तवमा छिमेकीको अनौपचारिक बाटो मात्र रहेको थाहा पाए। छिमेकीले जग्गा बेच्दा नयाँ मालिकले बाटो बन्द गरिदिए। स्थायी बाटो अधिकार कायम गर्न रु. १५ लाखभन्दा बढी र दुई वर्ष लाग्यो — बिक्री सम्झौतामा कतै उल्लेख थिएन।",
        },
        {
          outcome: "saved",
          title: "सम्झौता अघि सीमाना हिँडाइ",
          body: "दाङका क्रेताले टेपले नाप्दा दक्षिणी सीमा लालपुर्जाभन्दा करिब एक धुर कम देखियो। कुनै रकम नबुझाइ पहिले नै मूल्य घटाउन मिल्यो। पछि नापी सर्वेक्षणले पनि त्यही पुष्टि गर्यो।",
        },
        {
          outcome: "loss",
          title: "राम्रो पाखोबारी, खेर बाली",
          body: "सिन्धुलीमा एक क्रेताले व्यावसायिक तरकारीका लागि बेचिएको पाखोबारी किने। पहिलो सिजनमै डाँडाको जंगलबाट आएका बाँदरले अधिकांश बाली नष्ट गरे। छिमेकीले विक्रेता पनि यही कारणले दुई वर्षअघि खेती छोडेको बताए। पूरै बार लगाउन खेती सुरु गर्ने बजेटभन्दा बढी लाग्यो।",
        },
      ],
    },
    {
      heading: "३. सरकारी तथा स्थानीय मापदण्ड",
      paragraphs: [
        "जग्गा अभिलेखमा वर्गीकरण हुन्छ — खेत, आवासीय (अबादी), वन, व्यापारिक आदि। कृषि जग्गामा घर बनाउन प्रायः जग्गा रूपान्तरण र स्थानीय स्वीकृति चाहिन्छ; वर्गीकरण नहेरी किन्दा निर्माण अड्किन सक्छ। स्थानीय तहको भू–उपयोग नक्साले क्षेत्र कृषि, आवासीय वा व्यापारिक कसरी चिनिएको छ देखाउँछ।",
        "वडा र नगरपालिकाबाट सेटब्याक लाइन, न्यूनतम बाटो चौडाइ, खतरा वा संरक्षण क्षेत्रमा पर्छ कि पर्दैन सोध्नुहोस्। सडक विस्तार, उच्च भोल्टेज लाइन वा सार्वजनिक प्राप्ति सूचनाले धेरै क्रेतालाई असर पारेका छन् जसले मात्र लालपुर्जा हेरे।",
      ],
      checklist: [
        "लालपुर्जाको वर्गीकरण — खेत वा अबादी; तपाईंको प्रयोजनका लागि रूपान्तरण चाहिन्छ?",
        "भू–उपयोग नक्सा — स्थानीय तहमा आवासीय, व्यापारिक वा कृषि जोन।",
        "निर्माण सेटब्याक — सडक केन्द्ररेखा र सीमानाबाट न्यूनतम दूरी।",
        "जग्गा रूपान्तरण — कृषिबाट आवासीयमा परिवर्तनका शुल्क र समय।",
        "सार्वजनिक प्राप्ति — सडक विस्तार, पाइपलाइन वा आयोजना सूचना वडा/नगरपालिकामा।",
        "ऐलानी जग्गा — किन्नुअघि जग्गा सरकारी वा दर्ता नभएको (ऐलानी) होइन भनेर पुष्टि गर्ने।",
        "पूर्वाधार — पानी, बिजुली, ढल; केही जग्गामा नक्सा पास नै मिल्दैन।",
      ],
      examples: [
        {
          outcome: "loss",
          title: "किनेपछि घरको नक्सा पास नभएको",
          body: "चितवनमा एक क्रेताले 'यहाँ सबैले घर बनाएका छन्' भन्दै खेत वर्गको जग्गा किने। नगरपालिकाले रूपान्तरण र अस्तित्वमा भन्दा चौडा बाटो बिना नक्सा पास दिएन। रूपान्तरण र बाटो योगदानमा रु. १२ लाखभन्दा बढी थपियो — बिचौलियाले कहिल्यै भन्ने गरेको थिएन।",
        },
        {
          outcome: "saved",
          title: "वडामा जोन जाँच",
          body: "बुटवलमा व्यापारिक जग्गाको टोकन अघि क्रेताले वडामा स्थानीय योजनामा व्यापारिक क्षेत्र रहेको पुष्टि गरे। एक गल्ली परको सस्तो जग्गा कृषि मात्र थियो; त्यहाँ किनेका साथीहरूले अझै पनि पसल खोल्न पाएका छैनन्।",
        },
      ],
    },
    {
      heading: "४. रकम हस्तान्तरण अघि",
      paragraphs: [
        "लिखित सम्झौता (टाइप वा स्ट्याम्प) मा मूल्य, भुक्तानी तालिका, दाखिला खारेज म्याद र कर/शुल्क कसले तिर्ने भन्ने स्पष्ट लेख्नुहोस्। सक्दो भए बैंकिङ च्यानलबाट टोकन बुझाउनुहोस्। विक्रेताले नगद मात्र र मालपोत जाँच नगर्न दबाब दिए भने त्यो छुट होइन, चेतावनी हो।",
        "रोपनी र बिघा क्रस–चेक गर्न र दर्ता शुल्क अनुमान गर्न हाम्रो जग्गा रूपान्तरण र जग्गा दर्ता कर क्याल्कुलेटर उपयोगी हुन सक्छ — तर क्याल्कुलेटरले मालपोत जाँचको ठाउँ लिन सक्दैन।",
      ],
      checklist: [
        "म्याद र जरिवानासहित लिखित बिक्री सम्झौता।",
        "जाँचका चरणसँग जोडिएको किस्ता — मालपोत पुष्टि अघि पूरै रकम नदिने।",
        "संयुक्त वा उत्तराधिकारी सम्पत्ति भए सबै विक्रेताको पहिचान र सहमति।",
        "उत्तराधिकार / बकसपत्र — वंशानुगत जग्गा भए सबै हकदारको सहमति।",
        "दर्ता कर, वकिल/नोटरी र सर्वे खर्च — जग्गा मूल्य बाहेक बजेट बनाउने।",
      ],
    },
  ],
  checklistTitle: "टोकन बुझाउनु अघि छोटो जाँचसूची",
  quickChecklist: [
    "मालपोतमा लालपुर्जा र ट्रेस नक्सा जाँच",
    "तिरो र घरजग्गा कर रसिद",
    "रोक्का, अदालती मुद्दा वा धितो छैन",
    "नापी / क्षेत्रफल कागजसँग मिल्छ",
    "कानुनी बाटो पहुँच पुष्टि",
    "मोही वा सीमा विवाद छैन",
    "कृषि जग्गामा बादर र बँदेल जोखिम जाँच",
    "जग्गा वर्ग र स्थानीय जोन योजनासँग मिल्छ",
    "लिखित सम्झौता र ट्रेस योग्य भुक्तानी",
  ],
  closing:
    "जग्गा किन्दा गरिने जाँच आकर्षक हुँदैन। बिचौलियालाई मन पर्दैन र सौदा ढिलो हुन्छ — त्यही कारणले यसले तपाईंलाई बचाउँछ। पैसा गुमाउने परिवारले प्रायः नेपालको कानून कठिन भएकाले होइन; जाँचलाई वैकल्पिक ठानेँ भनेर हो।",
  disclaimer:
    "यो लेख नेपालमा जग्गा किन्नेहरूका लागि सामान्य जानकारी हो, कानुनी सल्लाह होइन। नियम स्थानीय तह र समयअनुसार फरक हुन सक्छ। ठूलो रकमको किनमेलमा सम्पत्ति वकिलसँग सल्लाह लिनुहोस् र सम्बन्धित मालपोत तथा स्थानीय कार्यालयमा प्रत्यक्ष पुष्टि गर्नुहोस्।",
};

export const CONSIDERATION_ARTICLES: Record<
  string,
  Partial<Record<"en" | "ne", ConsiderationArticle>>
> = {
  "property-construction/buying-land": {
    en: BUYING_LAND_EN,
    ne: BUYING_LAND_NE,
  },
};

export function getConsiderationArticle(
  categorySlug: string,
  topicSlug: string,
  lang: "en" | "ne"
): ConsiderationArticle | null {
  return CONSIDERATION_ARTICLES[`${categorySlug}/${topicSlug}`]?.[lang] ?? null;
}

export function hasConsiderationArticle(categorySlug: string, topicSlug: string): boolean {
  return Boolean(CONSIDERATION_ARTICLES[`${categorySlug}/${topicSlug}`]);
}
