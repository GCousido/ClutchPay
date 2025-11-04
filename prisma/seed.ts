import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Utilities
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sample<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const length = randInt(8, 16)
  return Array.from({ length }, () => sample(chars.split(''))).join('')
}

function randomEuropeanPhone(): string | null {
  // 50% chance of null
  if (Math.random() < 0.5) return null
  
  const countryCode = sample(['+34', '+33', '+49', '+39', '+351', '+44', '+31', '+32'])
  const number = Array.from({ length: 9 }, () => randInt(0, 9)).join('')
  return `${countryCode} ${number}`
}

function randomCountry(): string | null {
  // 30% chance of null
  if (Math.random() < 0.3) return null
  return sample(['ES', 'FR', 'DE', 'IT', 'PT', 'GB', 'NL', 'BE', 'AT', 'SE'])
}

function randomImageUrl(id: number): string | null {
  // 20% chance of null
  if (Math.random() < 0.2) return null
  return `https://i.pravatar.cc/200?u=${id}`
}

function formatInvoiceNumber(n: number): string {
  return `INV-${new Date().getFullYear()}-${String(n).padStart(6, '0')}`
}

function randomAmount(min = 50, max = 5000): string {
  return (Math.round((Math.random() * (max - min) + min) * 100) / 100).toFixed(2)
}

function randomDate(daysAgo: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - randInt(0, daysAgo))
  return date
}

async function main() {
  console.log('🌱 Starting seed...')

  // Clean existing data
  console.log('🧹 Cleaning existing data...')
  await prisma.notification.deleteMany({})
  await prisma.payment.deleteMany({})
  await prisma.invoice.deleteMany({})
  await prisma.user.deleteMany({})

  // Create 40 users
  console.log('👥 Creating 40 users...')
  const userDatas = Array.from({ length: 40 }).map((_, i) => ({
    email: `user${i + 1}@example.com`,
    password: `password${i}`,
    name: `FirstName${i + 1}`,
    surnames: `LastName${i + 1} Surname${i + 1}`,
    phone: randomEuropeanPhone(),
    country: randomCountry(),
    imageUrl: randomImageUrl(i + 1),
  }))

  const users: any[] = []
  for (const userData of userDatas) {
    const user = await prisma.user.create({ data: userData })
    users.push(user)
  }
  console.log(`✅ Created ${users.length} users`)

  // Create invoices (0-8 per user)
  console.log('📄 Creating invoices...')
  let invoiceCounter = 1
  const allInvoices: any[] = []
  
  // Track invoice relationships for contact suggestions
  const invoiceRelations = new Map<string, number>() // key: "issuerId-debtorId", value: count

  for (const issuer of users) {
    const invoiceCount = randInt(0, 8)
    
    for (let j = 0; j < invoiceCount; j++) {
      // Select a different user as debtor
      let debtor = sample(users)
      while (debtor.id === issuer.id) {
        debtor = sample(users)
      }

      const amount = randomAmount(100, 5000)
      const issueDate = randomDate(365)
      const dueDate = new Date(issueDate)
      dueDate.setDate(issueDate.getDate() + randInt(15, 90))
      
      const invoiceNumber = formatInvoiceNumber(invoiceCounter++)

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          issuerUserId: issuer.id,
          debtorUserId: debtor.id,
          subject: `Service Invoice ${invoiceNumber}`,
          description: `Professional services rendered - ${sample(['Consulting', 'Development', 'Design', 'Marketing', 'Support'])}`,
          amount,
          status: 'PENDING',
          issueDate,
          dueDate,
          invoicePdfUrl: `https://storage.example.com/invoices/${invoiceNumber}.pdf`,
        },
      })

      allInvoices.push({ invoice, issuer, debtor })

      // Track relationship
      const relationKey = `${issuer.id}-${debtor.id}`
      invoiceRelations.set(relationKey, (invoiceRelations.get(relationKey) || 0) + 1)
    }
  }
  console.log(`✅ Created ${allInvoices.length} invoices`)

  // Pay 75-85% of invoices
  console.log('💳 Creating payments...')
  const paymentPercentage = 0.75 + Math.random() * 0.10 // 75-85%
  const invoicesToPay = Math.floor(allInvoices.length * paymentPercentage)
  
  // Shuffle invoices and pay the first N
  const shuffled = [...allInvoices].sort(() => 0.5 - Math.random())
  const paidInvoices = shuffled.slice(0, invoicesToPay)

  for (const { invoice } of paidInvoices) {
    const paymentDate = new Date(invoice.issueDate)
    const daysUntilDue = Math.floor((new Date(invoice.dueDate).getTime() - new Date(invoice.issueDate).getTime()) / (1000 * 3600 * 24))
    paymentDate.setDate(paymentDate.getDate() + randInt(1, Math.max(1, daysUntilDue)))

    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        paymentDate,
        paymentMethod: sample(['PAYPAL', 'VISA', 'MASTERCARD', 'OTHER']) as any,
        paymentReference: `PAY-${invoice.invoiceNumber}-${randInt(1000, 9999)}`,
        receiptPdfUrl: `https://storage.example.com/receipts/${invoice.invoiceNumber}.pdf`,
        subject: Math.random() < 0.7 ? `Payment for ${invoice.invoiceNumber}` : null,
      },
    })

    // Update invoice status to PAID
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID' },
    })
  }
  console.log(`✅ Created ${paidInvoices.length} payments (${Math.round(paymentPercentage * 100)}%)`)

  // Mark some overdue invoices
  const pendingInvoices = allInvoices.filter(({ invoice }) => invoice.status === 'PENDING')
  const overdueCount = Math.floor(pendingInvoices.length * 0.3) // 30% of pending are overdue
  
  for (let i = 0; i < overdueCount; i++) {
    const { invoice } = pendingInvoices[i]
    const pastDue = new Date()
    pastDue.setDate(pastDue.getDate() - randInt(1, 30))
    
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { 
        status: 'OVERDUE',
        dueDate: pastDue,
      },
    })
    pendingInvoices[i].invoice.status = 'OVERDUE'
  }
  console.log(`⚠️  Marked ${overdueCount} invoices as OVERDUE`)

  // Create contacts based on invoice relationships
  console.log('🤝 Creating contacts based on invoice relationships...')
  const contactPairs = new Set<string>()
  
  for (const user of users) {
    // Find users with most invoice interactions
    const interactions: Array<{ userId: number; count: number }> = []
    
    for (const [key, count] of invoiceRelations.entries()) {
      const [issuerId, debtorId] = key.split('-').map(Number)
      if (issuerId === user.id) {
        interactions.push({ userId: debtorId, count })
      } else if (debtorId === user.id) {
        interactions.push({ userId: issuerId, count })
      }
    }

    // Sort by interaction count and take top contacts
    interactions.sort((a, b) => b.count - a.count)
    const topContacts = interactions.slice(0, randInt(2, 8))

    for (const { userId } of topContacts) {
      const pairKey = [user.id, userId].sort().join('-')
      if (!contactPairs.has(pairKey)) {
        contactPairs.add(pairKey)
        
        await prisma.user.update({
          where: { id: user.id },
          data: {
            contacts: {
              connect: { id: userId },
            },
          },
        })
      }
    }
  }
  console.log(`✅ Created ${contactPairs.size} contact relationships`)

  // Create notifications based on invoice/payment states
  console.log('🔔 Creating notifications...')
  let notificationCount = 0

  for (const { invoice, issuer, debtor } of allInvoices) {
    // INVOICE_ISSUED notification for debtor (when invoice is created)
    if (Math.random() < 0.8) { // 80% of invoices generate this notification
      await prisma.notification.create({
        data: {
          userId: debtor.id,
          invoiceId: invoice.id,
          type: 'INVOICE_ISSUED',
          read: Math.random() < 0.6, // 60% read
        },
      })
      notificationCount++
    }

    // PAYMENT_RECEIVED notification for issuer (when paid)
    if (invoice.status === 'PAID') {
      await prisma.notification.create({
        data: {
          userId: issuer.id,
          invoiceId: invoice.id,
          type: 'PAYMENT_RECEIVED',
          read: Math.random() < 0.7, // 70% read
        },
      })
      notificationCount++
    }

    // PAYMENT_DUE notification for debtor (when approaching due date and not paid)
    if (invoice.status === 'PENDING') {
      const daysUntilDue = Math.floor((new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 3600 * 24))
      if (daysUntilDue <= 7 && daysUntilDue >= 0) {
        await prisma.notification.create({
          data: {
            userId: debtor.id,
            invoiceId: invoice.id,
            type: 'PAYMENT_DUE',
            read: Math.random() < 0.3, // 30% read (more urgent, less likely to be read)
          },
        })
        notificationCount++
      }
    }

    // PAYMENT_OVERDUE notification for debtor (when overdue)
    if (invoice.status === 'OVERDUE') {
      await prisma.notification.create({
        data: {
          userId: debtor.id,
          invoiceId: invoice.id,
          type: 'PAYMENT_OVERDUE',
          read: Math.random() < 0.4, // 40% read
        },
      })
      notificationCount++
    }
  }
  console.log(`✅ Created ${notificationCount} notifications`)

  // Summary
  console.log('\n📊 Seed Summary:')
  console.log(`   👥 Users: ${users.length}`)
  console.log(`   📄 Invoices: ${allInvoices.length}`)
  console.log(`   💳 Payments: ${paidInvoices.length} (${Math.round((paidInvoices.length / allInvoices.length) * 100)}%)`)
  console.log(`   ⏳ Pending: ${pendingInvoices.length - overdueCount}`)
  console.log(`   ⚠️  Overdue: ${overdueCount}`)
  console.log(`   🤝 Contact pairs: ${contactPairs.size}`)
  console.log(`   🔔 Notifications: ${notificationCount}`)
  console.log('\n✨ Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
