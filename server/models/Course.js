const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  videoUrl: String,
  duration: Number, // in minutes
  order: {
    type: Number,
    required: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  resources: [{
    name: String,
    url: String,
    type: {
      type: String,
      enum: ['pdf', 'video', 'audio', 'document', 'link', 'other']
    }
  }]
}, { timestamps: true });

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  maxPoints: {
    type: Number,
    required: true,
    min: 0
  },
  instructions: String,
  attachments: [{
    name: String,
    url: String,
    size: Number
  }],
  submissions: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    content: String,
    attachments: [{
      name: String,
      url: String,
      size: Number
    }],
    grade: {
      points: Number,
      feedback: String,
      gradedAt: Date,
      gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    isLate: {
      type: Boolean,
      default: false
    }
  }]
}, { timestamps: true });

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  shortDescription: {
    type: String,
    maxlength: 500
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['programming', 'design', 'business', 'marketing', 'data-science', 'other']
  },
  level: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  thumbnail: String,
  coverImage: String,
  tags: [String],
  prerequisites: [String],
  learningObjectives: [String],
  lessons: [lessonSchema],
  assignments: [assignmentSchema],
  enrolledStudents: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    completedLessons: [{
      lesson: mongoose.Schema.Types.ObjectId,
      completedAt: Date
    }],
    lastAccessedAt: Date
  }],
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    allowReviews: {
      type: Boolean,
      default: true
    },
    autoEnroll: {
      type: Boolean,
      default: false
    },
    certificateEnabled: {
      type: Boolean,
      default: false
    },
    discussionEnabled: {
      type: Boolean,
      default: true
    }
  },
  analytics: {
    totalViews: {
      type: Number,
      default: 0
    },
    totalEnrollments: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
    },
    averageTimeSpent: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
courseSchema.index({ instructor: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ level: 1 });
courseSchema.index({ isPublished: 1 });
courseSchema.index({ 'rating.average': -1 });
courseSchema.index({ createdAt: -1 });
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Virtual for total duration
courseSchema.virtual('totalDuration').get(function() {
  return this.lessons.reduce((total, lesson) => total + (lesson.duration || 0), 0);
});

// Virtual for total lessons
courseSchema.virtual('totalLessons').get(function() {
  return this.lessons.length;
});

// Virtual for enrollment count
courseSchema.virtual('enrollmentCount').get(function() {
  return this.enrolledStudents.length;
});

// Method to calculate completion rate
courseSchema.methods.calculateCompletionRate = function() {
  if (this.enrolledStudents.length === 0) return 0;
  
  const completedStudents = this.enrolledStudents.filter(
    enrollment => enrollment.progress === 100
  ).length;
  
  return (completedStudents / this.enrolledStudents.length) * 100;
};

// Method to update rating
courseSchema.methods.updateRating = function() {
  if (this.reviews.length === 0) {
    this.rating.average = 0;
    this.rating.count = 0;
    return;
  }
  
  const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  this.rating.average = totalRating / this.reviews.length;
  this.rating.count = this.reviews.length;
};

// Pre-save middleware
courseSchema.pre('save', function(next) {
  if (this.isModified('reviews')) {
    this.updateRating();
  }
  
  if (this.isModified('isPublished') && this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

module.exports = mongoose.model('Course', courseSchema);